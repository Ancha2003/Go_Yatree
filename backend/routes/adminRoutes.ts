import express from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { SystemConfig } from '../models/SystemConfig';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify admin
const verifyAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create User/Driver
router.post('/users', verifyAdmin, async (req, res) => {
  try {
    const { displayName, email, password, role, phoneNumber, vehicleInfo } = req.body;
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash(password, 10);
    
    const userData: any = {
      displayName,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      isActive: true
    };

    if (role === 'driver') {
      userData.vehicleInfo = vehicleInfo;
      userData.isVerified = true;
    }

    const user = new User(userData);
    await user.save();
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update User/Driver
router.put('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { displayName, email, phoneNumber, role, vehicleInfo, isActive, isVerified } = req.body;
    const updateData: any = { displayName, email, phoneNumber, role, isActive };
    
    if (role === 'driver') {
      updateData.vehicleInfo = vehicleInfo;
      updateData.isVerified = isVerified;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete User/Driver
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all drivers
router.get('/drivers', verifyAdmin, async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' }).sort({ createdAt: -1 });
    res.json(drivers);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Verify driver
router.post('/verify-driver/:id', verifyAdmin, async (req, res) => {
  try {
    const { isVerified } = req.body;
    const driver = await User.findByIdAndUpdate(req.params.id, { isVerified }, { new: true });
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle user/driver active status
router.post('/toggle-active/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get/Update System Config
router.get('/config', verifyAdmin, async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig();
      await config.save();
    }
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/config', verifyAdmin, async (req, res) => {
  try {
    const config = await SystemConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all rides
router.get('/rides', verifyAdmin, async (req, res) => {
  try {
    const rides = await Ride.find().populate('userId driverId').sort({ createdAt: -1 });
    res.json(rides);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get Admin Stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalDrivers = await User.countDocuments({ role: 'driver' });
    const rides = await Ride.find({ status: 'completed' });
    
    const totalRevenue = rides.reduce((acc, ride) => acc + ride.fare, 0);
    // Assuming 20% commission is profit
    const totalProfit = totalRevenue * 0.2;
    
    const activeRides = await Ride.countDocuments({ 
      status: { $in: ['searching', 'confirmed', 'arriving', 'ongoing'] } 
    });

    res.json({
      totalUsers,
      totalDrivers,
      totalRevenue,
      totalProfit,
      activeRides,
      totalCompletedRides: rides.length
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Seed demo drivers
router.post('/seed-demo-drivers', verifyAdmin, async (req, res) => {
  try {
    const demoDrivers = [
      {
        displayName: 'Auto Raja',
        email: 'raja@demo.com',
        password: 'password123',
        phoneNumber: '9876543210',
        role: 'driver',
        isOnline: true,
        isVerified: true,
        isDemo: true,
        vehicleInfo: { model: 'Bajaj RE', plateNumber: 'UP 16 AT 0001', color: 'Yellow', type: 'Auto' },
        currentLocation: { type: 'Point', coordinates: [77.2090, 28.6139] } // Delhi
      },
      {
        displayName: 'Speedy Sonu',
        email: 'sonu@demo.com',
        password: 'password123',
        phoneNumber: '9876543211',
        role: 'driver',
        isOnline: true,
        isVerified: true,
        isDemo: true,
        vehicleInfo: { model: 'Piaggio Ape', plateNumber: 'UP 16 AT 0002', color: 'Yellow', type: 'Auto' },
        currentLocation: { type: 'Point', coordinates: [77.2190, 28.6239] }
      }
    ];

    for (const d of demoDrivers) {
      const existing = await User.findOne({ email: d.email });
      if (!existing) {
        const user = new User(d);
        await user.save();
      }
    }

    res.json({ message: 'Demo drivers seeded' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete all demo drivers
router.delete('/demo-drivers', verifyAdmin, async (req, res) => {
  try {
    await User.deleteMany({ isDemo: true });
    res.json({ message: 'All demo drivers deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle demo driver online status
router.post('/toggle-demo-online/:id', verifyAdmin, async (req, res) => {
  try {
    const driver = await User.findOne({ _id: req.params.id, isDemo: true });
    if (!driver) return res.status(404).json({ error: 'Demo driver not found' });
    driver.isOnline = !driver.isOnline;
    await driver.save();
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
