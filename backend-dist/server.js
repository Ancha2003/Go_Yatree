"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vite_1 = require("vite");
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const driverRoutes_1 = __importDefault(require("./routes/driverRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const rideRoutes_1 = __importDefault(require("./routes/rideRoutes"));
const User_1 = require("./models/User");
const Ride_1 = require("./models/Ride");
dotenv_1.default.config();
async function startServer() {
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    const PORT = 3000;
    // MongoDB Connection
    const MONGODB_URI = process.env.MONGODB_URI;
    if (MONGODB_URI) {
        mongoose_1.default.connect(MONGODB_URI)
            .then(async () => {
            console.log("Connected to MongoDB");
            // Seed Admin if not exists
            const adminEmail = 'admin@gmail.com';
            const adminPassword = 'Admin123';
            const adminExists = await User_1.User.findOne({ email: adminEmail });
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
            if (!adminExists) {
                const hashedPassword = await bcrypt.default.hash(adminPassword, 10);
                const admin = new User_1.User({
                    displayName: 'System Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    phoneNumber: '0000000000',
                    role: 'admin',
                    isActive: true
                });
                await admin.save();
                console.log(`Admin user seeded: ${adminEmail} / ${adminPassword}`);
            }
            else {
                const passwordMatches = await bcrypt.default.compare(adminPassword, adminExists.password);
                if (!passwordMatches) {
                    const hashedPassword = await bcrypt.default.hash(adminPassword, 10);
                    adminExists.password = hashedPassword;
                    await adminExists.save();
                    console.log(`Admin password reset for ${adminEmail} to the default README password.`);
                }
            }
        })
            .catch((err) => console.error("MongoDB connection error:", err));
    }
    else {
        console.warn("MONGODB_URI not found in environment variables. Running without database.");
    }
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // API routes
    app.use("/api/auth", authRoutes_1.default);
    app.use("/api/driver", driverRoutes_1.default);
    app.use("/api/admin", adminRoutes_1.default);
    app.use("/api/ride", rideRoutes_1.default);
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });
    // Socket.io logic
    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);
        socket.on("join", (userId) => {
            console.log(`User ${userId} joined their personal room`);
            socket.join(userId);
        });
        socket.on("join-ride", (rideId) => {
            socket.join(rideId);
        });
        socket.on("join-admin", () => {
            console.log("Admin joined the admin room");
            socket.join("admins");
        });
        const notifyAdmins = async (rideId) => {
            try {
                const ride = await Ride_1.Ride.findById(rideId)
                    .populate('userId', 'displayName email phoneNumber')
                    .populate('driverId', 'displayName email phoneNumber vehicleInfo stats');
                if (ride) {
                    io.to("admins").emit("ride-updated", ride);
                }
            }
            catch (err) {
                console.error("Error notifying admins:", err);
            }
        };
        socket.on("ride-request", async (data) => {
            console.log("New ride request:", data);
            try {
                // Find nearby real drivers within 5km
                let nearbyDrivers = await User_1.User.find({
                    role: 'driver',
                    isOnline: true,
                    isDemo: false,
                    currentLocation: {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [data.pickup.lng, data.pickup.lat]
                            },
                            $maxDistance: 5000 // 5km
                        }
                    }
                });
                // If no real drivers, find demo drivers
                if (nearbyDrivers.length === 0) {
                    nearbyDrivers = await User_1.User.find({
                        role: 'driver',
                        isDemo: true,
                        currentLocation: {
                            $near: {
                                $geometry: {
                                    type: 'Point',
                                    coordinates: [data.pickup.lng, data.pickup.lat]
                                },
                                $maxDistance: 5000
                            }
                        }
                    });
                }
                if (nearbyDrivers.length === 0) {
                    socket.emit("no-drivers-available");
                    return;
                }
                // Create ride in DB
                const ride = new Ride_1.Ride({
                    userId: data.userId,
                    pickup: data.pickup,
                    dropoff: data.dropoff,
                    fare: parseFloat(data.fare.replace('₹', '')),
                    status: 'searching',
                    otp: Math.floor(1000 + Math.random() * 9000).toString()
                });
                await ride.save();
                notifyAdmins(ride._id.toString());
                // Broadcast to nearby drivers specifically
                nearbyDrivers.forEach(driver => {
                    io.to(driver._id.toString()).emit("new-ride-request", {
                        ...data,
                        rideId: ride._id,
                        otp: ride.otp,
                        targetDriverId: driver._id
                    });
                });
                socket.emit("ride-request-sent", { rideId: ride._id });
                // FAIL-SAFE: If no driver accepts within 10 seconds, auto-assign a demo driver
                setTimeout(async () => {
                    const currentRide = await Ride_1.Ride.findById(ride._id);
                    if (currentRide && currentRide.status === 'searching') {
                        const demoDriver = await User_1.User.findOne({ role: 'driver', isDemo: true });
                        if (demoDriver) {
                            currentRide.driverId = demoDriver._id;
                            currentRide.status = 'confirmed';
                            currentRide.statusHistory.push({ status: 'confirmed', timestamp: new Date() });
                            await currentRide.save();
                            notifyAdmins(currentRide._id.toString());
                            io.to(currentRide.userId.toString()).emit("ride-accepted", {
                                rideId: currentRide._id,
                                userId: currentRide.userId,
                                otp: currentRide.otp,
                                fare: currentRide.fare,
                                driverName: demoDriver.displayName,
                                driverPhoto: demoDriver.photoURL,
                                vehicleInfo: demoDriver.vehicleInfo
                            });
                        }
                    }
                }, 10000);
            }
            catch (error) {
                console.error("Ride request error:", error);
            }
        });
        socket.on("accept-ride", async (data) => {
            console.log("Ride accepted by driver:", data);
            try {
                const ride = await Ride_1.Ride.findByIdAndUpdate(data.rideId, {
                    driverId: data.driverId,
                    status: 'confirmed',
                    $push: { statusHistory: { status: 'confirmed', timestamp: new Date() } }
                }, { new: true }).populate('driverId');
                if (!ride)
                    return;
                const driver = await User_1.User.findById(data.driverId);
                // Notify user
                const rideUpdate = {
                    rideId: ride._id,
                    userId: ride.userId,
                    otp: ride.otp,
                    fare: ride.fare,
                    driverName: driver?.displayName || "Driver",
                    driverPhoto: driver?.photoURL,
                    vehicleInfo: driver?.vehicleInfo || { model: "Auto", plateNumber: "UP 16 AB 1234", color: "Yellow" }
                };
                io.to(ride.userId.toString()).emit("ride-accepted", rideUpdate);
                io.to(data.driverId).emit("ride-accepted", rideUpdate);
                notifyAdmins(ride._id.toString());
            }
            catch (error) {
                console.error("Accept ride error:", error);
            }
        });
        socket.on("driver-arrived", async (data) => {
            console.log("Driver arrived:", data);
            const ride = await Ride_1.Ride.findByIdAndUpdate(data.rideId, {
                status: 'arriving',
                $push: { statusHistory: { status: 'arriving', timestamp: new Date() } }
            }, { new: true });
            if (ride) {
                io.to(ride.userId.toString()).emit("driver-arrived", { userId: ride.userId, rideId: ride._id });
                if (ride.driverId)
                    io.to(ride.driverId.toString()).emit("driver-arrived", { userId: ride.userId, rideId: ride._id });
                notifyAdmins(ride._id.toString());
            }
        });
        socket.on("start-ride", async (data) => {
            console.log("Ride started:", data);
            const ride = await Ride_1.Ride.findByIdAndUpdate(data.rideId, {
                status: 'ongoing',
                startTime: new Date(),
                $push: { statusHistory: { status: 'ongoing', timestamp: new Date() } }
            }, { new: true });
            if (ride) {
                io.to(ride.userId.toString()).emit("start-ride", { userId: ride.userId, rideId: ride._id });
                if (ride.driverId)
                    io.to(ride.driverId.toString()).emit("start-ride", { userId: ride.userId, rideId: ride._id });
                notifyAdmins(ride._id.toString());
            }
        });
        socket.on("complete-ride", async (data) => {
            console.log("Ride completed:", data);
            try {
                const ride = await Ride_1.Ride.findByIdAndUpdate(data.rideId, {
                    status: 'completed',
                    endTime: new Date(),
                    $push: { statusHistory: { status: 'completed', timestamp: new Date() } }
                }, { new: true });
                if (ride && ride.driverId) {
                    await User_1.User.findByIdAndUpdate(ride.driverId, {
                        $inc: {
                            'stats.totalEarnings': ride.fare,
                            'stats.totalRides': 1
                        }
                    });
                    io.to(ride.userId.toString()).emit("complete-ride", { userId: ride.userId, rideId: ride._id });
                    io.to(ride.driverId.toString()).emit("complete-ride", { userId: ride.userId, rideId: ride._id });
                    notifyAdmins(ride._id.toString());
                }
            }
            catch (error) {
                console.error("Complete ride error:", error);
            }
        });
        socket.on("rate-driver", async (data) => {
            console.log("Driver rated:", data);
            try {
                const { driverId, rating } = data;
                const driver = await User_1.User.findById(driverId);
                if (driver && driver.stats) {
                    const currentRating = driver.stats.rating || 5;
                    const currentCount = driver.stats.ratingCount || 0;
                    const newCount = currentCount + 1;
                    const newRating = ((currentRating * currentCount) + rating) / newCount;
                    await User_1.User.findByIdAndUpdate(driverId, {
                        'stats.rating': newRating,
                        'stats.ratingCount': newCount
                    });
                }
            }
            catch (error) {
                console.error("Rate driver error:", error);
            }
        });
        socket.on("cancel-ride", async (data) => {
            console.log("Ride cancelled:", data);
            const ride = await Ride_1.Ride.findByIdAndUpdate(data.rideId, {
                status: 'cancelled',
                cancelledBy: data.cancelledBy,
                cancellationReason: data.reason || 'No reason provided',
                $push: { statusHistory: { status: 'cancelled', timestamp: new Date() } }
            }, { new: true });
            if (ride) {
                // Notify the other party
                const targetId = data.cancelledBy === 'user' ? ride.driverId?.toString() : ride.userId.toString();
                if (targetId) {
                    io.to(targetId).emit("ride-cancelled", {
                        userId: ride.userId,
                        rideId: ride._id,
                        cancelledBy: data.cancelledBy,
                        reason: data.reason
                    });
                }
                notifyAdmins(ride._id.toString());
            }
        });
        socket.on("send-message", (data) => {
            console.log("Message sent:", data);
            const targetId = data.toDriver ? data.driverId : data.userId;
            if (targetId) {
                io.to(targetId).emit("receive-message", {
                    userId: data.userId,
                    message: data.message,
                    toDriver: data.toDriver
                });
            }
        });
        socket.on("update-location", (data) => {
            if (data.rideId) {
                socket.to(data.rideId).emit("location-updated", data.location);
            }
        });
        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await (0, vite_1.createServer)({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }
    else {
        const distPath = path_1.default.join(process.cwd(), "dist");
        app.use(express_1.default.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path_1.default.join(distPath, "index.html"));
        });
    }
    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
startServer();
