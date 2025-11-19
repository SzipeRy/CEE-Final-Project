document.addEventListener('DOMContentLoaded', () => {

    // URL ของ Backend (ถ้า deploy ต้องเปลี่ยน)
<<<<<<< HEAD
    const API_BASE_URL = 'http://34.236.156.163:3222/api'; // (ถ้า deploy บน EC2 ให้เปลี่ยนเป็น Public IP)
=======
    const API_BASE_URL = 'http://54.167.60.8:3222/api'; // (ถ้า deploy บน EC2 ให้เปลี่ยนเป็น Public IP)
>>>>>>> 07d18d1823ccbc20a6331257c11fbc33d415f880

    // State ของ Application
    let token = localStorage.getItem('token');
    let username = localStorage.getItem('username');
    let gameInProgress = false;
    let timerInterval;
    let startTime;
    let targetText = "";

    // --- DOM Elements ---
    // Views
    const views = document.querySelectorAll('.view');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const gameView = document.getElementById('game-view');
    const leaderboardView = document.getElementById('leaderboard-view');
    
    // Nav
    const navLoggedIn = document.getElementById('nav-logged-in');
    const navLoggedOut = document.getElementById('nav-logged-out');
    const welcomeUser = document.getElementById('welcome-user');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navRegisterBtn = document.getElementById('nav-register-btn');
    const navGameBtn = document.getElementById('nav-game-btn');
    const navLeaderboardBtn = document.getElementById('nav-leaderboard-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');

    // Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');

    // Game
    const difficultySelect = document.getElementById('difficulty-select');
    const timerDisplay = document.getElementById('timer');
    const wpmDisplay = document.getElementById('wpm-display');
    const accuracyDisplay = document.getElementById('accuracy-display');
    const textContainer = document.getElementById('text-to-type-container');
    const textDisplay = document.getElementById('text-to-type');
    const typingInput = document.getElementById('typing-input');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameMessage = document.getElementById('game-message');

    // Leaderboard
    const leaderboardDifficulty = document.getElementById('leaderboard-difficulty');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const leaderboardLoading = document.getElementById('leaderboard-loading');

    //delete account
    const navDeleteBtn = document.getElementById('nav-delete-btn');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deletePasswordInput = document.getElementById('delete-confirm-password');

    // --- 1. Helper Functions ---

    // สลับหน้าจอ (SPA Logic)
    function showView(viewId) {
        views.forEach(view => view.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
    }

    // อัปเดต UI ตามสถานะ Login
    function updateLoginState() {
        if (token) {
            navLoggedIn.classList.remove('hidden');
            navLoggedOut.classList.add('hidden');
            welcomeUser.textContent = `Welcome, ${username}!`;
            showView('game-view'); // Login แล้วไปหน้าเกม
        } else {
            navLoggedIn.classList.add('hidden');
            navLoggedOut.classList.remove('hidden');
            welcomeUser.textContent = '';
            showView('login-view'); // ยังไม่ Login ไปหน้า Login
        }
    }

    // ฟังก์ชันสำหรับ Fetch API (พร้อมแนบ Token)
    async function apiFetch(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }


    // --- 2. Navigation Event Listeners ---
    navLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    navRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); showView('register-view'); });
    navGameBtn.addEventListener('click', (e) => { e.preventDefault(); showView('game-view'); resetGame(); });
    navLeaderboardBtn.addEventListener('click', (e) => { e.preventDefault(); showView('leaderboard-view'); fetchLeaderboard(); });
    
    navLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        token = null;
        username = null;
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        updateLoginState();
    });

    // --- 3. Authentication (Login/Register) ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        registerSuccess.textContent = '';
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        try {
            await apiFetch('/auth/register', 'POST', { username, password });
            registerSuccess.textContent = 'Registration successful! Please login.';
            registerForm.reset();
        } catch (error) {
            registerError.textContent = error.message;
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const usernameInput = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const data = await apiFetch('/auth/login', 'POST', { username: usernameInput, password });
            token = data.token;
            username = data.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            updateLoginState();
            loginForm.reset();
            resetGame(); // โหลด text ใหม่เมื่อ login
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    navDeleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        deletePasswordInput.value = ''; // เคลียร์ช่องรหัสผ่าน
        deleteModal.classList.remove('hidden'); // แสดง Modal
    });

    // 2. กดปุ่ม Cancel -> ปิด Modal
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });

    // 3. กดปุ่ม Confirm Delete -> ยิง API ไปลบ
    confirmDeleteBtn.addEventListener('click', async () => {
        const password = deletePasswordInput.value;

        if (!password) {
            alert("กรุณาใส่รหัสผ่าน");
            return;
        }

        const confirmText = confirm("คุณแน่ใจจริงๆ ใช่ไหม? ข้อมูลจะหายหมดเลยนะ!");
        if (!confirmText) return;

        try {
            // ยิง API ไปที่ backend
            const res = await fetch(`${API_BASE_URL}/auth/delete-account`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // ต้องส่ง Token เพื่อบอกว่าเป็นใคร
                },
                body: JSON.stringify({ password: password }) // ส่งรหัสผ่านไปยืนยัน
            });

            const data = await res.json(); // รับค่าตอบกลับจาก Server

            if (res.ok) {
                // 1. แจ้งเตือนผู้ใช้
                alert('ลบบัญชีเรียบร้อยแล้ว'); 
    
                // 2. ปิดหน้าต่าง Modal
                deleteModal.classList.add('hidden');
    
                // 3. 👇 เพิ่มโค้ดชุดนี้เข้าไปครับ (สำคัญ) 👇
                localStorage.removeItem('token');    // ลบกุญแจ Token ทิ้ง
                localStorage.removeItem('username'); // ลบชื่อ User ทิ้ง
                window.location.reload();            // สั่งรีโหลดหน้าจอ (มันจะเด้งกลับไป Login เอง)
                // 👆 จบโค้ดที่เพิ่ม 👆

            } else {
                alert(`ลบไม่สำเร็จ: ${data.message}`);
            }

        } catch (error) {
            console.error("Error deleting account:", error);
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        }
    });

    // --- 4. Leaderboard Logic ---
    leaderboardDifficulty.addEventListener('change', fetchLeaderboard);

    async function fetchLeaderboard() {
        const difficulty = leaderboardDifficulty.value;
        leaderboardLoading.textContent = 'Loading...';
        leaderboardBody.innerHTML = '';
        
        try {
            const data = await apiFetch(`/game/leaderboard/${difficulty}`);
            if (data.length === 0) {
                leaderboardLoading.textContent = 'No data available for this difficulty.';
                return;
            }

            leaderboardLoading.textContent = '';
            let sortField;
            if (difficulty === 'Normal') sortField = 'avgSpeedNormal';
            else if (difficulty === 'NormalPlus') sortField = 'avgSpeedNormalPlus';
            else sortField = 'avgSpeedNormalProMax';

            data.forEach((entry, index) => {
                const row = `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${entry.username}</td>
                        <td>${entry[sortField].toFixed(2)} WPM</td>
                    </tr>
                `;
                leaderboardBody.innerHTML += row;
            });

        } catch (error) {
            leaderboardLoading.textContent = `Error: ${error.message}`;
        }
    }


    // --- 5. Game Logic ---
    
    // (Requirement: Cannot copy paste)
    typingInput.addEventListener('paste', (e) => e.preventDefault());

    // Load new text when difficulty changes
    difficultySelect.addEventListener('change', resetGame);
    startGameBtn.addEventListener('click', startGame);

    // 5.1 Reset Game / Load Text
    async function resetGame() {
        if (!token) {
            textDisplay.innerHTML = '<span>Please login to play.</span>';
            typingInput.disabled = true;
            startGameBtn.disabled = true;
            return;
        }
        
        gameInProgress = false;
        clearInterval(timerInterval);
        timerDisplay.textContent = '0';
        wpmDisplay.textContent = '0';
        accuracyDisplay.textContent = '100';
        typingInput.value = '';
        typingInput.disabled = true;
        startGameBtn.disabled = true;
        gameMessage.textContent = '';
        
        textContainer.classList.add('loading');
        textDisplay.innerHTML = ''; // Clear old text

        try {
            const difficulty = difficultySelect.value;
            const data = await apiFetch(`/game/get-text/${difficulty}`);
            targetText = data.text;
            
            // แสดง text ในแบบ span ทีละตัว
            textDisplay.innerHTML = targetText
                .split('')
                .map(char => `<span>${char}</span>`)
                .join('');
            
            textContainer.classList.remove('loading');
            startGameBtn.disabled = false;
            startGameBtn.textContent = "Start Game";

        } catch (error) {
            textContainer.classList.remove('loading');
            textDisplay.innerHTML = `<span class="error">Error loading text: ${error.message}</span>`;
        }
    }

    // 5.2 Start Game
    function startGame() {
        if (targetText.length === 0) return;

        gameInProgress = true;
        typingInput.disabled = false;
        typingInput.focus();
        startGameBtn.disabled = true;

        startTime = new Date();
        timerInterval = setInterval(() => {
            const seconds = Math.floor((new Date() - startTime) / 1000);
            timerDisplay.textContent = seconds;
            calculateWPM(seconds); // อัปเดต WPM สด
        }, 1000);
    }

    // 5.3 On Typing Input
    typingInput.addEventListener('input', () => {
        if (!gameInProgress) return;

        const allChars = textDisplay.querySelectorAll('span');
        const typedChars = typingInput.value.split('');
        let correctCount = 0;

        allChars.forEach((charSpan, index) => {
            const char = typedChars[index];

            if (char == null) { // ยังพิมพ์ไม่ถึง
                charSpan.className = '';
            } else if (char === charSpan.textContent) { // พิมพ์ถูก
                charSpan.className = 'correct';
                correctCount++;
            } else { // พิมพ์ผิด
                charSpan.className = 'incorrect';
            }
        });

        // Update accuracy
        if (typedChars.length > 0) {
            const accuracy = (correctCount / typedChars.length) * 100;
            accuracyDisplay.textContent = accuracy.toFixed(0);
        } else {
            accuracyDisplay.textContent = '100';
        }

        // Check for game end
        if (typedChars.length === targetText.length && correctCount === targetText.length) {
            endGame();
        }
    });

    // 5.4 Calculate WPM
    function calculateWPM(seconds) {
        if (seconds === 0) return;
        const typedWords = typingInput.value.trim().split(' ').length;
        const wpm = (typedWords / seconds) * 60;
        wpmDisplay.textContent = wpm.toFixed(0);
        return wpm;
    }

    // 5.5 End Game
    async function endGame() {
        gameInProgress = false;
        clearInterval(timerInterval);
        typingInput.disabled = true;
        startGameBtn.disabled = false;
        startGameBtn.textContent = "Play Again";
        
        const seconds = Math.floor((new Date() - startTime) / 1000);
        const finalWPM = calculateWPM(seconds);
        const finalAccuracy = parseFloat(accuracyDisplay.textContent);

        gameMessage.textContent = `Game Over! Final WPM: ${finalWPM.toFixed(0)}, Accuracy: ${finalAccuracy}%`;

        // Submit score to backend
        try {
            const difficulty = difficultySelect.value;
            const result = await apiFetch('/game/submit-score', 'POST', {
                difficulty: difficulty,
                wpm: finalWPM,
                accuracy: finalAccuracy
            });
            console.log('Score submitted:', result);
        } catch (error) {
            gameMessage.textContent += ` (Error submitting score: ${error.message})`;
        }
    }


    // --- 6. Initial Load ---
    updateLoginState(); // ตรวจสอบสถานะ login เมื่อโหลดหน้า
    if (token) {
        resetGame(); // ถ้า login อยู่แล้ว ให้โหลด text เลย
    }

});