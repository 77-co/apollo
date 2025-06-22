// Node.js wake word detection handler using Python subprocess

import {spawn} from "child_process";
import EventEmitter from "events";

export default class WakeWord extends EventEmitter {
    constructor(config = {}) {
        super();

        this.scriptPath = config.scriptPath || "wake/main.py";
        this.pythonPath =
            config.pythonPath ||
            (process.platform === "win32" ? "python" : "python3");
        this.paused = false;
        this.process = null;

        // Bind cleanup to process events
        process.on("exit", () => this._cleanup());
        process.on("SIGINT", () => process.exit());
        process.on("SIGTERM", () => process.exit());
        process.on("uncaughtException", () => process.exit());
    }

    start() {
        this.process = spawn(this.pythonPath, [this.scriptPath]);
        this.process.stdout.on("data", (data) => {
            const output = data.toString().trim();
            console.log(output);
            if (output.includes("WAKE") && !this.paused) {
                this.emit("wake");
                this.paused = true;
            }
        });
    }

    stop() {
        this.process.kill();
        this.process = null;
    }

    _cleanup() {
        if (this.process) {
            this.process.kill("SIGTERM"); // Or "SIGKILL" if necessary
            this.process = null;
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