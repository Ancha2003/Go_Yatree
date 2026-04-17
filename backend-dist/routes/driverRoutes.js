"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const Ride_1 = require("../models/Ride");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
// Middleware to verify driver
const verifyDriver = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        if (decoded.role !== 'driver')
            return res.status(403).json({ error: 'Forbidden' });
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
// Update driver documents
router.post('/documents', verifyDriver, async (req, res) => {
    try {
        const { panCard, aadhaarCard, vehicleRC, vehicleInfo } = req.body;
        const driver = await User_1.User.findByIdAndUpdate(req.user.id, {
            documents: { panCard, aadhaarCard, vehicleRC },
            vehicleInfo,
            isVerified: false // Reset verification on update
        }, { new: true });
        res.json(driver);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Toggle online status
router.post('/toggle-online', verifyDriver, async (req, res) => {
    try {
        const { isOnline } = req.body;
        const driver = await User_1.User.findByIdAndUpdate(req.user.id, { isOnline }, { new: true });
        res.json(driver);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get driver stats
router.get('/stats', verifyDriver, async (req, res) => {
    try {
        const driver = await User_1.User.findById(req.user.id);
        res.json(driver?.stats);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get ride history
router.get('/rides', verifyDriver, async (req, res) => {
    try {
        const rides = await Ride_1.Ride.find({ driverId: req.user.id }).sort({ createdAt: -1 });
        res.json(rides);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update driver location
router.post('/location', verifyDriver, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        await User_1.User.findByIdAndUpdate(req.user.id, {
            currentLocation: {
                type: 'Point',
                coordinates: [lng, lat]
            }
        });
        res.json({ message: 'Location updated' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update profile photo
router.post('/profile-photo', verifyDriver, async (req, res) => {
    try {
        const { photoURL } = req.body;
        const driver = await User_1.User.findByIdAndUpdate(req.user.id, { photoURL }, { new: true });
        res.json(driver);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
