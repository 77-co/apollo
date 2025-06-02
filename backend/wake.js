// Node.js wake word detection handler using Python subprocess

import {spawn} from "child_process";
import EventEmitter from "events";

export default class WakeWord extends EventEmitter {
    constructor(options = {}) {
        super();

        this.pythonScript = options.pythonScript || "wake/main.py";
        this.pythonPath = options.pythonPath || "python";
        this.process = null;
        this.isRunning = false;
        this.stats = {
            detectionsCount: 0,
            startTime: null,
            lastDetection: null,
            lastHeartbeat: null,
        };

        // Auto-restart settings
        this.autoRestart = options.autoRestart !== false; // Default true
        this.maxRestarts = options.maxRestarts || 5;
        this.restartCount = 0;
        this.restartDelay = options.restartDelay || 2000; // 2 seconds
    }

    start() {
        if (this.isRunning) {
            console.log("Wake word detector is already running");
            return;
        }

        console.log("Starting wake word detector...");
        this.stats.startTime = new Date();
        this.isRunning = true;
        this.restartCount = 0;

        this.spawnProcess();
    }

    spawnProcess() {
        try {
            // Spawn Python process
            this.process = spawn(this.pythonPath, [this.pythonScript], {
                stdio: ["pipe", "pipe", "pipe"],
            });

            console.log(`Python process started with PID: ${this.process.pid}`);

            // Handle stdout (JSON messages from Python)
            this.process.stdout.on("data", (data) => {
                const lines = data
                    .toString()
                    .split("\n")
                    .filter((line) => line.trim());

                lines.forEach((line) => {
                    try {
                        const message = JSON.parse(line);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error("Error parsing JSON from Python:", error);
                        console.error("Raw data:", line);
                    }
                });
            });

            // Handle stderr (Python errors/debug info)
            this.process.stderr.on("data", (data) => {
                console.error("Python stderr:", data.toString());
                this.emit(
                    "error",
                    new Error(`Python stderr: ${data.toString()}`)
                );
            });

            // Handle process exit
            this.process.on("close", (code, signal) => {
                console.log(
                    `Python process exited with code ${code}, signal ${signal}`
                );
                this.process = null;

                if (
                    this.isRunning &&
                    this.autoRestart &&
                    this.restartCount < this.maxRestarts
                ) {
                    this.restartCount++;
                    console.log(
                        `Restarting process (attempt ${this.restartCount}/${this.maxRestarts})...`
                    );

                    setTimeout(() => {
                        if (this.isRunning) {
                            this.spawnProcess();
                        }
                    }, this.restartDelay);
                } else if (this.restartCount >= this.maxRestarts) {
                    console.error(
                        "Maximum restart attempts reached. Stopping wake word detector."
                    );
                    this.isRunning = false;
                    this.emit(
                        "error",
                        new Error("Maximum restart attempts reached")
                    );
                }
            });

            // Handle process errors
            this.process.on("error", (error) => {
                console.error("Python process error:", error);
                this.emit("error", error);
            });
        } catch (error) {
            console.error("Failed to spawn Python process:", error);
            this.emit("error", error);
        }
    }

    handleMessage(message) {
        const { type, timestamp, data } = message;

        // Log all messages (you can remove this in production)
        console.log(
            `[${new Date(timestamp).toLocaleTimeString()}] ${type}:`,
            data
        );

        switch (type) {
            case "wake_word_detected":
                this.stats.detectionsCount++;
                this.stats.lastDetection = new Date(timestamp);

                console.log(
                    `🎉 WAKE WORD DETECTED! Confidence: ${data.confidence.toFixed(
                        3
                    )}`
                );

                // Emit event for your voice assistant to handle
                this.emit("wakeWordDetected", {
                    confidence: data.confidence,
                    model: data.model,
                    detectionNumber: data.detection_number,
                    timestamp: timestamp,
                });
                break;

            case "status":
                this.emit("status", data);

                if (data.status === "listening") {
                    console.log("✓ Wake word detector is now listening");
                    this.emit("ready");
                }
                break;

            case "heartbeat":
                this.stats.lastHeartbeat = new Date(timestamp);
                this.emit("heartbeat", data);
                break;

            case "confidence_report":
                this.emit("confidenceReport", data);
                break;

            case "error":
                console.error("Python error:", data.message);
                this.emit("error", new Error(data.message));
                break;

            default:
                console.log("Unknown message type:", type, data);
        }
    }

    stop() {
        console.log("Stopping wake word detector...");
        this.isRunning = false;

        if (this.process) {
            this.process.kill("SIGTERM");

            // Force kill after 5 seconds if it doesn't stop gracefully
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    console.log("Force killing Python process...");
                    this.process.kill("SIGKILL");
                }
            }, 5000);
        }
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            uptime: this.stats.startTime
                ? Date.now() - this.stats.startTime.getTime()
                : 0,
            processId: this.process ? this.process.pid : null,
        };
    }

    // Send a test message to Python (if you want to add two-way communication)
    sendMessage(message) {
        if (this.process && this.process.stdin.writable) {
            this.process.stdin.write(JSON.stringify(message) + "\n");
        }
    }
}

// Example usage
// if (require.main === module) {
//     // Create detector instance
//     const detector = new WakeWordDetector({
//         pythonScript: "wake_word_detector.py", // Path to your Python script
//         pythonPath: "python", // or 'python3' depending on your system
//         autoRestart: true,
//         maxRestarts: 3,
//     });

//     // Event handlers
//     detector.on("ready", () => {
//         console.log("Wake word detector is ready and listening!");
//     });

//     detector.on("wakeWordDetected", (data) => {
//         console.log("WAKE WORD EVENT:", data);

//         // Here's where you'd trigger your voice assistant
//         // For example:
//         // startVoiceRecognition();
//         // playWakeSound();
//         // activateAssistant();
//     });

//     detector.on("status", (data) => {
//         console.log("Status update:", data.status);
//     });

//     detector.on("error", (error) => {
//         console.error("Detector error:", error.message);
//     });

//     detector.on("heartbeat", (data) => {
//         console.log(
//             `Heartbeat - Uptime: ${Math.round(
//                 data.uptime_seconds
//             )}s, Detections: ${data.detections_count}`
//         );
//     });

//     // Start detection
//     detector.start();

//     // Graceful shutdown
//     process.on("SIGINT", () => {
//         console.log("\nShutting down...");
//         detector.stop();
//         setTimeout(() => process.exit(0), 1000);
//     });

//     // Example: Get stats every 10 seconds
//     setInterval(() => {
//         const stats = detector.getStats();
//         console.log("Stats:", stats);
//     }, 10000);
// }