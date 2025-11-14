const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Game = require('../models/gameModel');
const User = require('../models/userModel');
const { authMiddleware } = require('./authRoutes'); // import middleware

const router = express.Router();

// --- 1. READ: Get Text from LLM (Challenging Req) ---
// Config Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

router.get('/get-text/:difficulty', async (req, res) => {
    const { difficulty } = req.params;
    let prompt;

    // Prompt ตามที่คุณออกแบบ
    if (difficulty === 'Normal') {
        prompt = "Generate a single random paragraph, about 30 words long, for a typing test. Mix Thai and English words naturally.";
    } else if (difficulty === 'NormalPlus') {
        prompt = "Generate a single random paragraph, about 30 words long, for a typing test. Mix Thai, English, and common emojis (like 😊, 👍, or ❤️).";
    } else if (difficulty === 'NormalProMax') {
        prompt = "Generate a single random paragraph, about 30 words long, for a typing test. Mix Thai, English, emojis, and some words from other languages like Japanese (e.g., こんにちは) or Russian (e.g., Привет).";
    } else {
        return res.status(400).json({ message: 'Invalid difficulty.' });
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/\n/g, ' '); // เอาขึ้นบรรทัดใหม่ออก
        res.json({ text });
    } catch (error) {
        console.error("LLM Error:", error);
        res.status(500).json({ message: 'Error generating text from LLM.' });
    }
});

// --- 2. CREATE: Submit Game Score ---
// ใช้ authMiddleware เพื่อให้รู้ว่าใครเป็นคนส่ง score
router.post('/submit-score', authMiddleware, async (req, res) => {
    try {
        const { difficulty, wpm, accuracy } = req.body;
        const { userId, username } = req.user; // มาจาก token

        // 2.1 (CREATE Game) บันทึกประวัติการเล่น
        const newGame = new Game({
            userId,
            username,
            difficulty,
            wpm,
            accuracy
        });
        await newGame.save();

        // 2.2 (UPDATE User) อัปเดตสถิติเฉลี่ยของ User
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // คำนวณค่าเฉลี่ยใหม่ (Running Average)
        let totalGames, currentAvg;
        if (difficulty === 'Normal') {
            totalGames = user.gamePlayedNormal;
            currentAvg = user.avgSpeedNormal;
            user.avgSpeedNormal = (currentAvg * totalGames + wpm) / (totalGames + 1);
            user.gamePlayedNormal += 1;
        } else if (difficulty === 'NormalPlus') {
            totalGames = user.gamePlayedNormalPlus;
            currentAvg = user.avgSpeedNormalPlus;
            user.avgSpeedNormalPlus = (currentAvg * totalGames + wpm) / (totalGames + 1);
            user.gamePlayedNormalPlus += 1;
        } else if (difficulty === 'NormalProMax') {
            totalGames = user.gamePlayedNormalProMax;
            currentAvg = user.avgSpeedNormalProMax;
            user.avgSpeedNormalProMax = (currentAvg * totalGames + wpm) / (totalGames + 1);
            user.gamePlayedNormalProMax += 1;
        }

        await user.save();
        res.status(201).json({ message: 'Score saved successfully.', newAverage: user.avgSpeedNormal }); // ส่งตัวอย่างค่าเฉลี่ยใหม่กลับไป
    
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- 3. READ: Get Leaderboard ---
router.get('/leaderboard/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;

        // เราจะ query จาก `User` model ที่เก็บค่าเฉลี่ย (avgSpeed)
        // เพราะ Leaderboard ควรจะมาจากค่าเฉลี่ย ไม่ใช่คะแนนที่ดีที่สุดครั้งเดียว (ตามที่คุณออกแบบ)
        
        let sortField;
        if (difficulty === 'Normal') sortField = 'avgSpeedNormal';
        else if (difficulty === 'NormalPlus') sortField = 'avgSpeedNormalPlus';
        else if (difficulty === 'NormalProMax') sortField = 'avgSpeedNormalProMax';
        else return res.status(400).json({ message: 'Invalid difficulty.' });

        const leaderboard = await User.find({ [sortField]: { $gt: 0 } }) // เอาเฉพาะคนที่เคยเล่น
            .sort({ [sortField]: -1 }) // เรียงจากมากไปน้อย
            .limit(10) // เอาแค่ 10 อันดับ
            .select(`username ${sortField}`); // เลือกเฉพาะ field ที่ต้องการ

        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- 4. DELETE (Optional but good for CRUD) ---
// ให้ user ลบบัญชีตัวเอง (ต้อง login ก่อน)
router.delete('/delete-account', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;

        // ลบข้อมูล user
        await User.findByIdAndDelete(userId);
        
        // ลบประวัติการเล่นทั้งหมดของ user นี้
        await Game.deleteMany({ userId: userId });

        res.status(200).json({ message: 'Account and all related data deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


module.exports = router;