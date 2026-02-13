import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over");
const scoreEl = document.getElementById("score");
const livesContainer = document.getElementById("lives-bar");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const loadingText = document.getElementById("loading");

// Game State
let handLandmarker;
let isGameRunning = false;
let lastVideoTime = -1;
let score = 0;
let lives = 3;
let speedMultiplier = 1;

// Objects
const paddle = { x: 0, y: 0, width: 100, height: 15, color: "#00ffff" };
let items = []; // Holds both stars and bombs
let particles = []; // Explosion effects

// Asset Loading
const createHandLandmarker = async () => {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        loadingText.style.display = "none";
        startBtn.style.display = "block";
    } catch (error) {
        loadingText.textContent = "Error: " + error.message;
    }
};

const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.srcObject = stream;
        return new Promise(resolve => video.onloadeddata = resolve);
    } catch (err) {
        alert("Camera blocked. Please allow access.");
        return false;
    }
};

// --- Game Logic ---

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.life = 1.0; // 100% opacity
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.03; // Fade out
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnItem() {
    const isBomb = Math.random() < 0.25; // 25% chance of bomb
    items.push({
        x: Math.random() * (canvas.width - 20) + 10,
        y: -30,
        type: isBomb ? 'bomb' : 'star',
        size: isBomb ? 15 : 10,
        speed: (Math.random() * 2 + 2) * speedMultiplier
    });
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateGame() {
    if (!isGameRunning) return;

    // 1. Difficulty Scaling
    speedMultiplier = 1 + (score / 50);

    // 2. Spawn Items
    if (Math.random() < 0.02 * speedMultiplier) spawnItem();

    // 3. Update Items
    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.y += item.speed;

        // Collision Check (Simple box collision)
        if (
            item.y + item.size >= paddle.y &&
            item.y - item.size <= paddle.y + paddle.height &&
            item.x >= paddle.x &&
            item.x <= paddle.x + paddle.width
        ) {
            // Hit!
            if (item.type === 'star') {
                score += 10;
                createExplosion(item.x, item.y, "#00ffff");
            } else {
                lives--;
                createExplosion(item.x, item.y, "#ff0055");
                updateLivesUI();
                if (lives <= 0) gameOver();
            }
            items.splice(i, 1);
        }
        // Missed item
        else if (item.y > canvas.height) {
            items.splice(i, 1);
            if (item.type === 'star') {
                // Optional: Lose points for missing stars? 
                // For now, we just let them go.
            }
        }
    }

    // 4. Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    scoreEl.innerText = score;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Paddle (Glowing)
    ctx.shadowBlur = 20;
    ctx.shadowColor = paddle.color;
    ctx.fillStyle = paddle.color;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;

    // Draw Items
    for (let item of items) {
        if (item.type === 'star') {
            // Draw Blue Orb
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00ffff";
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Draw Red Asteroid
            ctx.fillStyle = "#ff0055";
            ctx.beginPath();
            ctx.moveTo(item.x, item.y - item.size);
            ctx.lineTo(item.x + item.size, item.y + item.size);
            ctx.lineTo(item.x - item.size, item.y + item.size);
            ctx.fill();
        }
    }

    // Draw Particles
    for (let p of particles) p.draw();
}

function updateLivesUI() {
    livesContainer.innerHTML = '';
    for(let i=0; i<lives; i++) {
        const pip = document.createElement('div');
        pip.className = 'life-pip';
        livesContainer.appendChild(pip);
    }
}

function gameOver() {
    isGameRunning = false;
    document.getElementById('final-score').innerText = score;
    gameOverScreen.style.display = 'flex';
}

function resetGame() {
    score = 0;
    lives = 3;
    speedMultiplier = 1;
    items = [];
    particles = [];
    isGameRunning = true;
    scoreEl.innerText = "0";
    updateLivesUI();
    
    startScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    
    // Resize once to be safe
    resizeCanvas();
    gameLoop();
}

// --- Tracking & Loop ---

async function predictWebcam() {
    if (video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const startTime = performance.now();
        const results = await handLandmarker.detectForVideo(video, startTime);

        if (results.landmarks && results.landmarks.length > 0) {
            const indexTip = results.landmarks[0][8];
            
            // Convert normalized coordinates (0-1) to canvas pixels
            // Note: (1 - x) because video is mirrored
            const targetX = (1 - indexTip.x) * canvas.width - (paddle.width / 2);
            
            // Smooth "Lerp" movement (makes it feel less jittery)
            paddle.x += (targetX - paddle.x) * 0.3;
        }
    }
    
    if (isGameRunning) requestAnimationFrame(predictWebcam);
}

function gameLoop() {
    if (!isGameRunning) return;
    updateGame();
    drawGame();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    if(video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        paddle.y = canvas.height - 40;
    }
}

// --- Initialization ---

startBtn.addEventListener("click", async () => {
    startBtn.innerText = "Accessing Camera...";
    await startCamera();
    resizeCanvas();
    resetGame();
    predictWebcam();
});

restartBtn.addEventListener("click", resetGame);

// Start
createHandLandmarker();