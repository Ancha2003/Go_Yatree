"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemConfig = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const systemConfigSchema = new mongoose_1.default.Schema({
    baseFare: { type: Number, default: 50 },
    perKmRate: { type: Number, default: 15 },
    perMinuteRate: { type: Number, default: 2 },
    minimumFare: { type: Number, default: 60 },
    updatedAt: { type: Date, default: Date.now }
});
exports.SystemConfig = mongoose_1.default.model('SystemConfig', systemConfigSchema);
