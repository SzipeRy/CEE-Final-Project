const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true }, // ใส่ username ไว้เลย จะได้ query ง่าย
    difficulty: { type: String, required: true, enum: ['Normal', 'NormalPlus', 'NormalProMax'] },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

// สร้าง Index เพื่อ query leaderboard ได้เร็วขึ้น
gameSchema.index({ difficulty: 1, wpm: -1 });

module.exports = mongoose.model('Game', gameSchema);