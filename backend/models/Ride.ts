import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

export const Ride = mongoose.model('Ride', rideSchema);
