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
// Middleware to verify user
const verifyUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
// Find nearby drivers
router.get('/nearby-drivers', verifyUser, async (req, res) => {
    console.log(`Nearby drivers request from user ${req.user.id}`);
    try {
        const { lat, lng, radius = 5 } = req.query; // radius in km
        if (!lat || !lng)
            return res.status(400).json({ error: 'Location required' });
        const lngNum = parseFloat(lng);
        const latNum = parseFloat(lat);
        // Find real online drivers
        let drivers = await User_1.User.find({
            role: 'driver',
            isOnline: true,
            currentLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lngNum, latNum]
                    },
                    $maxDistance: parseFloat(radius) * 1000
                }
            }
        });
        // If no real drivers, find demo drivers
        if (drivers.length === 0) {
            drivers = await User_1.User.find({
                role: 'driver',
                isDemo: true,
                'vehicleInfo.type': 'Auto',
                currentLocation: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [lngNum, latNum]
                        },
                        $maxDistance: parseFloat(radius) * 1000
                    }
                }
            });
        }
        res.json({ count: drivers.length, drivers });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Create ride request
router.post('/request', verifyUser, async (req, res) => {
    try {
        const { pickup, dropoff, fare, distance, duration } = req.body;
        const ride = new Ride_1.Ride({
            userId: req.user.id,
            pickup,
            dropoff,
            fare,
            distance,
            duration,
            status: 'searching',
            statusHistory: [{ status: 'searching', timestamp: new Date() }]
        });
        await ride.save();
        res.status(201).json(ride);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update location (for both users and drivers)
router.post('/update-location', verifyUser, async (req, res) => {
    console.log(`Update location request from user ${req.user.id}`);
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
// Cancel ride
router.post('/cancel/:id', verifyUser, async (req, res) => {
    try {
        const { reason, cancelledBy } = req.body;
        const ride = await Ride_1.Ride.findById(req.params.id);
        if (!ride)
            return res.status(404).json({ error: 'Ride not found' });
        if (ride.status === 'completed' || ride.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled ride' });
        }
        ride.status = 'cancelled';
        ride.cancellationReason = reason || 'No reason provided';
        ride.cancelledBy = cancelledBy || 'user';
        ride.statusHistory.push({ status: 'cancelled', timestamp: new Date() });
        await ride.save();
        res.json({ message: 'Ride cancelled successfully', ride });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Rate driver
router.post('/rate/:id', verifyUser, async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const ride = await Ride_1.Ride.findById(req.params.id);
        if (!ride)
            return res.status(404).json({ error: 'Ride not found' });
        if (!ride.driverId)
            return res.status(400).json({ error: 'No driver assigned to this ride' });
        // Update ride with rating and feedback
        await Ride_1.Ride.findByIdAndUpdate(req.params.id, {
            rating,
            feedback
        });
        const driver = await User_1.User.findById(ride.driverId);
        if (driver) {
            const currentRating = driver.stats?.rating || 5;
            const totalRides = driver.stats?.totalRides || 0;
            const newRating = ((currentRating * totalRides) + rating) / (totalRides + 1);
            await User_1.User.findByIdAndUpdate(ride.driverId, {
                'stats.rating': newRating,
                $inc: { 'stats.totalRides': 1 }
            });
        }
        res.json({ message: 'Rating submitted' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get user ride history
router.get('/user-rides', verifyUser, async (req, res) => {
    try {
        const rides = await Ride_1.Ride.find({ userId: req.user.id })
            .populate('driverId', 'displayName vehicleInfo photoURL phoneNumber')
            .sort({ createdAt: -1 });
        res.json(rides);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
