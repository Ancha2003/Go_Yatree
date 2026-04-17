import express from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify driver
const verifyDriver = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'driver') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Update driver documents
router.post('/documents', verifyDriver, async (req: any, res) => {
  try {
    const { panCard, aadhaarCard, vehicleRC, vehicleInfo } = req.body;
    const driver = await User.findByIdAndUpdate(req.user.id, {
      documents: { panCard, aadhaarCard, vehicleRC },
      vehicleInfo,
      isVerified: false // Reset verification on update
    }, { new: true });
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle online status
router.post('/toggle-online', verifyDriver, async (req: any, res) => {
  try {
    const { isOnline } = req.body;
    const driver = await User.findByIdAndUpdate(req.user.id, { isOnline }, { new: true });
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get driver stats
router.get('/stats', verifyDriver, async (req: any, res) => {
  try {
    const driver = await User.findById(req.user.id);
    res.json(driver?.stats);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get ride history
router.get('/rides', verifyDriver, async (req: any, res) => {
  try {
    const rides = await Ride.find({ driverId: req.user.id }).sort({ createdAt: -1 });
    res.json(rides);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update driver location
router.post('/location', verifyDriver, async (req: any, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      currentLocation: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });
    res.json({ message: 'Location updated' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update profile photo
router.post('/profile-photo', verifyDriver, async (req: any, res) => {
  try {
    const { photoURL } = req.body;
    const driver = await User.findByIdAndUpdate(req.user.id, { photoURL }, { new: true });
    res.json(driver);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
