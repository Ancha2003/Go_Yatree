"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ride = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const rideSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    driverId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    pickup: {
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    dropoff: {
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    status: {
        type: String,
        enum: ['searching', 'confirmed', 'arriving', 'ongoing', 'completed', 'cancelled'],
        default: 'searching'
    },
    otp: { type: String },
    otpVerified: { type: Boolean, default: false },
    fare: { type: Number },
    distance: { type: Number }, // in km
    duration: { type: Number }, // in minutes
    paymentMethod: { type: String, default: 'cash' },
    startTime: { type: Date },
    endTime: { type: Date },
    cancelledBy: { type: String, enum: ['user', 'driver', 'admin', 'system'] },
    cancellationReason: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },
    statusHistory: [{
            status: String,
            timestamp: { type: Date, default: Date.now }
        }],
    createdAt: { type: Date, default: Date.now },
});
exports.Ride = mongoose_1.default.model('Ride', rideSchema);
