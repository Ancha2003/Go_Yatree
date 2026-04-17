import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const router = express.Router();

const normalizeEmail = (email: string | undefined) => email?.toLowerCase().trim() || '';
const emailQuery = (email: string) => ({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

router.post('/register', async (req, res) => {
  try {
    const { displayName, email, password, role, phoneNumber, documents, vehicleInfo, balance, photoURL } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData: any = { 
      displayName, 
      email: normalizedEmail, 
      password: hashedPassword, 
      role, 
      phoneNumber,
      balance: balance || 0,
      photoURL
    };

    if (role === 'driver') {
      userData.documents = documents;
      userData.vehicleInfo = vehicleInfo;
      userData.isVerified = false;
    }

    const user = new User(userData);
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne(emailQuery(normalizedEmail));

    // Dev fallback: create or reset admin account if missing or password is default
    if (!user && normalizedEmail === 'admin@gmail.com' && password === 'Admin123') {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        displayName: 'System Admin',
        email: normalizedEmail,
        password: hashedPassword,
        phoneNumber: '0000000000',
        role: 'admin',
        isActive: true
      });
      await user.save();
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // If admin exists but password is wrong, reset to default in dev mode
      if (user?.role === 'admin' && normalizedEmail === 'admin@gmail.com' && password === 'Admin123') {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated by admin' });
    }

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.tempOtp = otp;
    user.tempOtpExpires = expires;
    await user.save();

    console.log(`OTP for ${email}: ${otp}`); // Log for demo purposes

    res.json({ 
      message: `OTP sent to your registered mobile number. (DEMO: Your OTP is ${otp})`,
      requiresOtp: true,
      email: user.email,
      phoneNumber: user.phoneNumber.replace(/.(?=.{4})/g, '*') // Mask phone number
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login-verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne(emailQuery(normalizedEmail));

    if (!user || user.tempOtp !== otp || !user.tempOtpExpires || user.tempOtpExpires < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Clear OTP
    user.tempOtp = undefined;
    user.tempOtpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        displayName: user.displayName, 
        email: user.email, 
        role: user.role, 
        photoURL: user.photoURL 
      } 
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update profile
router.post('/update-profile', async (req: any, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const { displayName, photoURL, phoneNumber } = req.body;
    const user = await User.findByIdAndUpdate(decoded.id, {
      displayName,
      photoURL,
      phoneNumber
    }, { new: true });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add funds
router.post('/add-funds', async (req: any, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const { amount } = req.body;
    const user = await User.findByIdAndUpdate(decoded.id, {
      $inc: { balance: amount }
    }, { new: true });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
