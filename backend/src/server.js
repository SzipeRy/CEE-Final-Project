require('dotenv').config(); // โหลด .env ก่อน
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { router: authRoutes } = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

const app = express();
const PORT = 3222;

// --- Middlewares ---
app.use(cors()); // อนุญาต Cross-Origin Requests
app.use(express.json()); // ให้ Express อ่าน JSON body ได้

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));
// ... (ต่อจาก app.use('/api/game', gameRoutes);)
// Handle SPA routing - ส่ง index.html กลับไปเสมอถ้าไม่ใช่ API
app.get('/*', (req, res) => { // <--- ❗️แก้ไขบรรทัดนี้
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        // --- Start Server ---
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database connection error:', err);
    });