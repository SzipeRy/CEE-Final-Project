/*
* server.js
* (เวอร์ชันอัปเดต: แก้ไข env, เพิ่ม JWT, และ Game APIs)
*/

// --- 1. Imports ---
const path = require('path'); // ❗️❗️ 1. เอา 'path' ขึ้นมาบนสุด

// ❗️❗️ 2. บอก 'dotenv' ให้ไปหา .env ที่โฟลเดอร์แม่ ('../')
// require('dotenv').config();
// Load environment variables from the backend folder's .env (if present)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log("------------------------------------------------");
console.log("DEBUG CHECK:");
if (process.env.GEMINI_API_KEY) {
    console.log("✅ API KEY Found:", process.env.GEMINI_API_KEY.substring(0, 5) + "...");
} else {
    console.log("❌ API KEY NOT FOUND! (Check your .env file location)");
}
console.log("------------------------------------------------");

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // ❗️(แก้ไข) ต้องใช้ ObjectId
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // ⭐️ (เพิ่ม) สำหรับ LLM
const cors = require('cors');

// --- 2. Configuration ---
const app = express();
const port = 3222;

const mongoUrl = process.env.MONGODB_URI; // ❗️(แก้ไข) ใช้ process.env
const dbName = 'typingGameDB';
const client = new MongoClient(mongoUrl);

let db; // Database connection variable

// Config Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// --- 3. Connect to MongoDB ---
async function connectToDB() {
    try {
        await client.connect();
        console.log('Connected successfully to MongoDB');
        db = client.db(dbName);
    } catch (e) {
        console.error('Could not connect to MongoDB', e);
        process.exit(1);
    }
}

// --- 4. Middlewares ---
app.use(cors());
// Serve Static Files (จากโฟลเดอร์ 'public' หรือ 'frontend')
// ❗️ (หมายเหตุ) โค้ดก่อนหน้าผมใช้ 'frontend' แต่โค้ดนี้ใช้ 'public'
// ❗️ ให้แน่ใจว่าโฟลเดอร์นี้ตรงกับที่คุณเก็บ index.html
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// JSON Body Parser
app.use(express.json());

// ⭐️ (เพิ่ม) Authentication Middleware
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId: '...', username: '...' }
        next();
    } catch (ex) {
        res.status(400).json({ message: 'Invalid token.' });
    }
}

// --- 5. Authentication API Routes ---

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        const usersCollection = db.collection('User');
        const existingUser = await usersCollection.findOne({ username: username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken' });
        }
        
        // ❗️ (หมายเหตุ) โค้ดนี้ยังคงเก็บรหัสผ่านเป็น Plain Text
        // ❗️ ซึ่งโจทย์อนุญาต (เพราะห้ามใช้ bcrypt) แต่ไม่ปลอดภัยในโลกจริง
        const newUser = {
            username: username,
            password: password,
            gamePlayedNormal: 0, avgSpeedNormal: 0,
            gamePlayedNormalPlus: 0, avgSpeedNormalPlus: 0,
            gamePlayedNormalProMax: 0, avgSpeedNormalProMax: 0
        };
        
        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: 'User created successfully' });
    } catch (e) {
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        const usersCollection = db.collection('User');
        const user = await usersCollection.findOne({ username: username });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // ⭐️ (อัปเดต) สร้างและส่ง Token กลับไป
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        res.status(200).json({
            message: 'Login successful',
            username: user.username,
            token: token // ❗️ ส่ง token ให้ frontend
        });
        
    } catch (e) {
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

// --- 6. Game API Routes ---

// ⭐️ (เพิ่ม) GET Text from LLM
// ในไฟล์ server.js
// ...existing code...
app.get('/api/game/get-text/:difficulty', async (req, res) => {
    console.log("🚀 Received request for difficulty:", req.params.difficulty); // เช็กว่า Request เข้ามาจริงไหม

    // Helper: sleep
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Helper: retry wrapper for Gemini with exponential backoff
    async function generateFromGeminiWithRetries(localModel, prompt, maxAttempts = 3) {
        let lastErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🤖 Gemini attempt ${attempt}/${maxAttempts}...`);
                const result = await localModel.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                console.log("✅ Gemini responded successfully!");
                return text;
            } catch (err) {
                lastErr = err;
                const status = err?.status || (err?.message?.includes?.('overloaded') ? 503 : null);
                console.warn(`⚠️ Gemini error (attempt ${attempt}):`, err.message || err);
                // Retry only for transient server-side errors (503) or network issues
                if ((status === 503 || !status) && attempt < maxAttempts) {
                    const backoffMs = 500 * Math.pow(2, attempt - 1); // 500, 1000, 2000...
                    console.log(`⏳ Backing off ${backoffMs}ms then retrying...`);
                    await sleep(backoffMs);
                    continue;
                }
                break;
            }
        }
        throw lastErr;
    }

    // Fallback local generator if Gemini is unavailable
    function fallbackText(difficulty) {
        const samples = {
            Normal: [
                "ทดสอบการพิมพ์: The quick brown fox jumps over the lazy dog. ลองพิมพ์ดู!",
                "สวัสดีครับ This is a short mixed Thai-English sentence for typing practice."
            ],
            NormalPlus: [
                "ลองพิมพ์ 😊 Hello world! สวัสดี — type fast, stay focused! 🚀",
                "ภาษาไทย + English + emoji: สวัสดีครับ 🌟 Keep typing, keep improving!"
            ],
            NormalProMax: [
                "Symb0l$ & Th@ii: กรอกข้อความนี้ 12345 !@# Mix of symbols, ภาษาไทย และ English.",
                "PRO: ~!@#$%^&*() ภาษาไทย/English 12345 — speed test: พิมพ์เร็วๆ!"
            ]
        };
        const arr = samples[difficulty] || samples.Normal;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    try {
        const { difficulty } = req.params;

        console.log("🤖 Initializing Gemini-Pro model...");
        const localModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt;
        if (difficulty === 'Normal') {
            prompt = "สร้างคำแต่ละคำมั่วๆในภาษาไทยและอังกฤษเป็นคำๆ โดยสุ่มคำ 1 - 10 คำภาษานึงก้ได้แล้วสลับไปอีกภาษานึง โดยไม่ต้องแปล ให้คำภาษาไทยและอังกฤษไม่ต้องเหมือนกัน และเป็นคำที่ใช้ในชีวิตประจำวัน ประมาณ 30 คำเป็นย่อหน้า และไม่มีสัญลักษณ์ใดๆทั้งสิ้น คำแต่ละคำต้องเว้นวรรคด้วย โดยผลิตคำออกมาเลยไม่ต้องมีคำนำ";
        } else if (difficulty === 'NormalPlus') {
            prompt = "สร้างคำแต่ละคำมั่วๆในภาษาไทยและอังกฤษและอีโมจิเป็นคำๆ โดยสุ่มคำ 1 - 10 คำภาษานึงก้ได้แล้วสลับไปอีกภาษานึง โดยไม่ต้องแปล ให้คำภาษาไทยและอังกฤษไม่ต้องเหมือนกัน และเป็นคำที่ใช้ในชีวิตประจำวัน ประมาณ 30 คำเป็นย่อหน้า และไม่มีสัญลักษณ์ใดๆทั้งสิ้น คำแต่ละคำต้องเว้นวรรคด้วย โดยผลิตคำออกมาเลยไม่ต้องมีคำนำ";
        } else if (difficulty === 'NormalProMax') {
            prompt = "สร้างคำแต่ละคำมั่วๆในภาษาอะไรก้ได้อย่างเช่น ไทย อังกฤษ ญี่ปุ่น จีน กรีก อินเดีย และอื่นๆในภาษาบนโลกโดยใช้ตัวอักษรของภาษานั้น และอีโมจิเป็นคำๆ โดยสุ่มคำ 1 - 5 คำภาษานึงก้ได้แล้วสลับไปอีกภาษานึง โดยไม่ต้องแปล ให้คำภาษาไทยและอังกฤษไม่ต้องเหมือนกัน และเป็นคำที่ใช้ในชีวิตประจำวัน ประมาณ 30 คำเป็นย่อหน้า และไม่มีสัญลักษณ์ใดๆทั้งสิ้น คำแต่ละคำต้องเว้นวรรคด้วย โดยผลิตคำออกมาเลยไม่ต้องมีคำนำ";
        } else {
            return res.status(400).json({ message: 'Invalid difficulty.' });
        }

        // Try Gemini with retries; if it fails, use fallback text
        let text;
        try {
            text = await generateFromGeminiWithRetries(localModel, prompt, 3);
        } catch (llmErr) {
            console.error("🔥 LLM failed after retries:", llmErr?.message || llmErr);
            console.log("🛠 Using fallback generator due to LLM unavailability.");
            text = fallbackText(difficulty);
        }

        res.json({ text });

    } catch (error) {
        console.error("🔥 LLM Error Details:", error);
        res.status(500).json({ message: 'Error generating text from LLM.', details: error.message });
    }
});
// ...existing code...

// ⭐️ (เพิ่ม) POST Submit Game Score
app.post('/api/game/submit-score', authMiddleware, async (req, res) => {
    try {
        const { difficulty, wpm, accuracy } = req.body;
        const { userId, username } = req.user; // มาจาก token

        // 1. (CREATE) บันทึกประวัติการเล่น (ใน Collection ใหม่)
        const gamesCollection = db.collection('Games'); // Collection สำหรับประวัติ
        await gamesCollection.insertOne({
            userId: new ObjectId(userId),
            username,
            difficulty,
            wpm,
            accuracy,
            createdAt: new Date()
        });

        // 2. (UPDATE) อัปเดตสถิติเฉลี่ยของ User
        const usersCollection = db.collection('User');
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        
        // 3. คำนวณค่าเฉลี่ยใหม่
        let updates = {};
        let totalGames, currentAvg;

        if (difficulty === 'Normal') {
            totalGames = user.gamePlayedNormal;
            currentAvg = user.avgSpeedNormal;
            updates.avgSpeedNormal = (currentAvg * totalGames + wpm) / (totalGames + 1);
            updates.gamePlayedNormal = totalGames + 1;
        } else if (difficulty === 'NormalPlus') {
            totalGames = user.gamePlayedNormalPlus;
            currentAvg = user.avgSpeedNormalPlus;
            updates.avgSpeedNormalPlus = (currentAvg * totalGames + wpm) / (totalGames + 1);
            updates.gamePlayedNormalPlus = totalGames + 1;
        } else if (difficulty === 'NormalProMax') {
            totalGames = user.gamePlayedNormalProMax;
            currentAvg = user.avgSpeedNormalProMax;
            updates.avgSpeedNormalProMax = (currentAvg * totalGames + wpm) / (totalGames + 1);
            updates.gamePlayedNormalProMax = totalGames + 1;
        }

        // 4. บันทึกค่าใหม่ลง DB
        await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updates }
        );

        res.status(201).json({ message: 'Score saved successfully.' });
    
    } catch (error) {
        console.error("Submit Score Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ⭐️ (เพิ่ม) GET Leaderboard
app.get('/api/game/leaderboard/:difficulty', async (req, res) => {
    try {
        const { difficulty } = req.params;
        const usersCollection = db.collection('User');

        let sortField;
        if (difficulty === 'Normal') sortField = 'avgSpeedNormal';
        else if (difficulty === 'NormalPlus') sortField = 'avgSpeedNormalPlus';
        else if (difficulty === 'NormalProMax') sortField = 'avgSpeedNormalProMax';
        else return res.status(400).json({ message: 'Invalid difficulty.' });

        const leaderboard = await usersCollection
            .find({ [sortField]: { $gt: 0 } }) // เอาเฉพาะคนที่เคยเล่น
            .sort({ [sortField]: -1 }) // เรียงจากมากไปน้อย
            .limit(10) // เอาแค่ 10 อันดับ
            .project({ username: 1, [sortField]: 1, _id: 0 }) // เอาแค่ field ที่ต้องการ
            .toArray();

        res.json(leaderboard);
    } catch (error) {
        console.error("Leaderboard Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// --- 7. Start the Server ---
connectToDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${3222}`);
    });
});