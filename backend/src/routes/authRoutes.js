const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Game = require('../models/gameModel'); // ต้อง import มาเพื่อลบประวัติการเล่น

const router = express.Router();

// Middleware สำหรับตรวจสอบ Token (เราจะใช้ใน gameRoutes)
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId: '...', username: '...' }
        next();
    } catch (ex) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// --- CREATE User (Register) ---
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({ username, passwordHash });
        await newUser.save();

        res.status(201).json({ message: 'User created successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- READ User (Login) ---
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, {
            expiresIn: '1d', // Token หมดอายุใน 1 วัน
        });

        res.json({
            token,
            username: user.username
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/delete-account', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body; // รับรหัสผ่านจากหน้าบ้าน
        const userId = req.user.userId;

        // 1. หาข้อมูล User ในฐานข้อมูล
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. ตรวจสอบว่ารหัสผ่านที่กรอกมา ตรงกับในฐานข้อมูลไหม
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง ไม่สามารถลบบัญชีได้' });
        }

        // 3. ถ้ารหัสถูก -> ลบประวัติการเล่นทั้งหมดของคนนี้ก่อน
        await Game.deleteMany({ userId: userId });

        // 4. ลบข้อมูล User ออกจากระบบ
        await User.findByIdAndDelete(userId);

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Export middleware ไปด้วย
module.exports = { router, authMiddleware };