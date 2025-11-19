// check_list.js
const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ไม่พบ API KEY ใน .env");
    process.exit(1);
}

console.log("🔍 กำลังตรวจสอบรายชื่อ Model ที่ Account ของคุณใช้ได้...");
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("❌ Error จาก Google:", json.error.message);
            } else if (json.models) {
                console.log("\n✅ รายชื่อ Model ที่คุณใช้ได้ (Available Models):");
                console.log("------------------------------------------------");
                json.models.forEach(m => {
                    // กรองเอาเฉพาะรุ่นที่ generateContent ได้
                    if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(`👉 ${m.name.replace('models/', '')}`); 
                    }
                });
                console.log("------------------------------------------------");
                console.log("💡 ให้เลือกชื่อใดชื่อหนึ่งด้านบน ไปใส่ใน server.js ครับ");
            } else {
                console.log("⚠️ ไม่พบ Model ใดๆ เลย (แปลกมาก อาจต้องสร้าง Project ใหม่)");
                console.log(json);
            }
        } catch (e) {
            console.error("❌ Error parsing response:", e);
        }
    });
}).on('error', (err) => {
    console.error("❌ Network Error:", err.message);
});