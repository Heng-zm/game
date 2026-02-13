// Import necessary modules from MediaPipe
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.js";

// --- DOM and Canvas Setup ---
const video = document.getElementById("webcam");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const loadingMessage = document.getElementById("loading");
const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");
const gameOverDisplay = document.getElementById("game-over");
const restartButton = document.getElementById("restart-button");

// Set canvas dimensions
canvas.width = 640;
canvas.height = 480;

// --- Game State Variables ---
let score = 0;
let lives = 3;
let gameOver = false;
let handLandmarker;
let lastVideoTime = -1;

// --- Game Objects ---
const player = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 30,
    width: 100,
    height: 20,
    color: "#61dafb"
};

const stars = [];
const starRadius = 15;
const starSpeed = 2;

// --- Hand Tracking Setup ---
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
        numHands: 1 // Track only one hand
    });
    loadingMessage.style.display = "none";
    startGame(); // Start the game after model is loaded
};

// --- Webcam Setup ---
const enableCam = () => {
    if (!handLandmarker) {
        console.log("Wait! HandLandmarker not loaded yet.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadedmetadata", predictWebcam);
        })
        .catch((err) => {
            console.error(err);
            alert("Please enable webcam access to play.");
        });
};

// --- Game Logic ---
function spawnStar() {
    stars.push({
        x: Math.random() * canvas.width,
        y: -starRadius,
        color: `hsl(${Math.random() * 60 + 200}, 100%, 70%)` // Shades of blue/purple
    });
}

function updateGame() {
    if (gameOver) return;

    // Move stars down
    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.y += starSpeed;

        // Collision detection with paddle
        if (
            star.y + starRadius > player.y &&
            star.x > player.x &&
            star.x < player.x + player.width
        ) {
            score++;
            scoreDisplay.textContent = score;
            stars.splice(i, 1); // Remove caught star
        } 
        // Star missed
        else if (star.y > canvas.height) {
            lives--;
            livesDisplay.textContent = lives;
            stars.splice(i, 1); // Remove missed star
            if (lives <= 0) {
                endGame();
            }
        }
    }

    // Spawn new stars periodically
    if (Math.random() < 0.03) {
        spawnStar();
    }
}

function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player paddle
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.strokeStyle = "white";
    ctx.strokeRect(player.x, player.y, player.width, player.height);

    // Draw stars
    for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, starRadius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.stroke();
    }
}

function endGame() {
    gameOver = true;
    gameOverDisplay.style.display = "flex";
}

function restartGame() {
    score = 0;
    lives = 3;
    stars.length = 0;
    gameOver = false;
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    gameOverDisplay.style.display = "none";
    gameLoop(); // Restart the game loop
}

restartButton.addEventListener("click", restartGame);

// --- Main Prediction Loop ---
const predictWebcam = async () => {
    // Mirror the video feed on the canvas
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Perform hand detection
    const nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = await handLandmarker.detectForVideo(video, nowInMs);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            // Get the coordinate of the index finger tip (landmark #8)
            const indexFingerTip = landmarks[8];
            
            // Map the normalized coordinate (0.0 - 1.0) to the canvas width
            // We use (1 - x) because the video is mirrored
            const newPlayerX = (1 - indexFingerTip.x) * canvas.width - (player.width / 2);

            // Update player position smoothly
            player.x += (newPlayerX - player.x) * 0.2;
        }
    }
    
    // Continue the loop if the game is not over
    if (!gameOver) {
        window.requestAnimationFrame(gameLoop);
    }
};

// --- Game Loop ---
function gameLoop() {
    updateGame();
    drawGame();
    predictWebcam();
}

// --- Start the Application ---
function startGame() {
    enableCam();
}

// Initialize the hand landmarker when the script loads
createHandLandmarker();