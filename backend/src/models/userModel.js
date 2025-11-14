const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true }, // ไม่เก็บ plain password!
    
    // เก็บสถิติสรุป
    avgSpeedNormal: { type: Number, default: 0 },
    avgSpeedNormalPlus: { type: Number, default: 0 },
    avgSpeedNormalProMax: { type: Number, default: 0 },

    gamePlayedNormal: { type: Number, default: 0 },
    gamePlayedNormalPlus: { type: Number, default: 0 },
    gamePlayedNormalProMax: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);