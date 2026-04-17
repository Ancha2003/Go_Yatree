import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  role: { type: String, enum: ['user', 'driver', 'admin'], default: 'user' },
  photoURL: { type: String },
  isActive: { type: Boolean, default: true },
  isDemo: { type: Boolean, default: false },
  
  // Driver specific fields
  isVerified: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  documents: {
    panCard: { type: String },
    aadhaarCard: { type: String },
    vehicleRC: { type: String },
  },
  vehicleInfo: {
    model: { type: String },
    plateNumber: { type: String },
    color: { type: String },
    type: { type: String, enum: ['Auto', 'Go', 'XL', 'Premier'], default: 'Auto' }
  },
  wallet: {
    balance: { type: Number, default: 0 },
    transactions: [{
      amount: Number,
      type: { type: String, enum: ['credit', 'debit'] },
      description: String,
      date: { type: Date, default: Date.now }
    }]
  },
  stats: {
    totalEarnings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    rating: { type: Number, default: 5 },
    ratingCount: { type: Number, default: 0 }
  },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },

  createdAt: { type: Date, default: Date.now },
  tempOtp: { type: String },
  tempOtpExpires: { type: Date },
});

userSchema.index({ currentLocation: '2dsphere' });

export const User = mongoose.model('User', userSchema);
