import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

const video = document.getElementById("webcam");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const gameContainer = document.getElementById("game-container");
const loadingMessage = document.getElementById("loading");
const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");
const gameOverDisplay = document.getElementById("game-over");
const restartButton = document.getElementById("restart-button");

let score = 0;
let lives = 3;
let gameOver = false;
let handLandmarker;
let lastVideoTime = -1;

// Player object (positions will be set dynamically)
const player = {
    x: 0,
    y: 0,
    width: 80, // Slightly smaller for mobile
    height: 15,
    color: "#61dafb"
};

const stars = [];
const starRadius = 10;
const starSpeed = 3;

// --- 1. Hand Tracking Setup ---
const createHandLandmarker = async () => {
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
    loadingMessage.style.display = "none";
    enableCam();
};

// --- 2. Webcam Setup (Front Camera & Resizing) ---
const enableCam = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        alert("Camera not supported");
        return;
    }

    // Constraints: Prefer front camera, ideal resolution
    const constraints = {
        video: {
            facingMode: "user", // "user" = Front Camera, "environment" = Back Camera
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadeddata", () => {
                resizeGame(); // Adjust canvas size to match camera
                predictWebcam();
            });
        })
        .catch((err) => {
            console.error(err);
            alert("Camera denied or not found. Ensure HTTPS/localhost.");
        });
};

// --- 3. Resize Logic (Crucial for Mobile) ---
function resizeGame() {
    if (!video.videoWidth) return;

    // Set canvas internal resolution to match the raw video feed
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Adjust container aspect ratio to match video
    // This prevents the video from looking stretched
    const aspectRatio = video.videoWidth / video.videoHeight;
    gameContainer.style.aspectRatio = `${aspectRatio}`;

    // Reset player position to bottom center
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 40;
}

// Handle screen rotation
window.addEventListener('resize', () => {
    // Optional: add logic here if you need to handle dynamic window resizing
    // Usually video.loadeddata handles the initial setup enough
});

// --- 4. Game Logic ---
function spawnStar() {
    stars.push({
        x: Math.random() * canvas.width,
        y: -starRadius,
        color: `hsl(${Math.random() * 60 + 200}, 100%, 70%)`
    });
}

function updateGame() {
    if (gameOver) return;

    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.y += starSpeed;

        // Collision
        if (
            star.y + starRadius > player.y &&
            star.x > player.x &&
            star.x < player.x + player.width
        ) {
            score++;
            scoreDisplay.textContent = score;
            stars.splice(i, 1);
        } 
        else if (star.y > canvas.height) {
            lives--;
            livesDisplay.textContent = lives;
            stars.splice(i, 1);
            if (lives <= 0) endGame();
        }
    }

    if (Math.random() < 0.03) spawnStar();
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Stars
    for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, starRadius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.fill();
    }
}

function endGame() {
    gameOver = true;
    gameOverDisplay.style.display = "flex";
}

restartButton.addEventListener("click", () => {
    score = 0;
    lives = 3;
    stars.length = 0;
    gameOver = false;
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    gameOverDisplay.style.display = "none";
    gameLoop();
});

const predictWebcam = async () => {
    // Draw video to canvas (Mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = await handLandmarker.detectForVideo(video, nowInMs);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const indexFingerTip = landmarks[8];
            
            // Map 0-1 coordinates to canvas width
            const targetX = (1 - indexFingerTip.x) * canvas.width - (player.width / 2);
            
            // Smooth movement
            player.x += (targetX - player.x) * 0.2;
        }
    }
    
    if (!gameOver) window.requestAnimationFrame(gameLoop);
};

function gameLoop() {
    updateGame();
    drawGame();
    predictWebcam();
}

createHandLandmarker();