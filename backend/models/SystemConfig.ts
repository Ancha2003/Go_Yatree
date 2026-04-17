import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  baseFare: { type: Number, default: 50 },
  perKmRate: { type: Number, default: 15 },
  perMinuteRate: { type: Number, default: 2 },
  minimumFare: { type: Number, default: 60 },
  updatedAt: { type: Date, default: Date.now }
});

export const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
