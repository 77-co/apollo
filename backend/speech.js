// Voice recognition
import { SpeechClient } from "@google-cloud/speech";
import record from "node-record-lpcm16";

// TTS
import OpenAI from "openai";
import { spawn } from "child_process";

const TTS_INSTRUCTIONS = `You are a voice assistant speaking in a clear, neutral tone. Your voice should sound calm, concise, and slightly warm — welcoming, but not overly emotional or enthusiastic. Avoid exaggerated inflection. Maintain a natural, human cadence, with subtle pauses where appropriate. Your delivery should be helpful and attentive, without sounding robotic or monotone.`;

// Initialise the Speech client
const client = new SpeechClient();

// Initialise the OpenAI SDK and a sound player
const openai = new OpenAI();

// Keep track of the current ffplay instance
const noPlayer = { kill: () => null };
let currentPlayer = null;

export function transcribeStream(onTranscript, onFinalResult) {
    // Kill any currently playing audio
    if (currentPlayer) {
        currentPlayer.kill();
        currentPlayer = null;
    }

    // Abort any ongoing TTS stream
    if (currentStreamAbortController) {
        currentStreamAbortController.abort();
        currentStreamAbortController = null;
    }

    // Configure request for streaming recognition
    const request = {
        config: {
            encoding: "LINEAR16", // Audio encoding
            sampleRateHertz: 16000, // Sample rate
            languageCode: "pl-PL", // Preferred language
        },
        interimResults: true, // For real-time results
    };

    let audioStream;
    let recognizeStream;
    let audioProcess = null;

    // Initialize variables for tracking speech
    let lastSpokenTime = Date.now();
    const silenceTimeout = 3000; // Max silence window in ms
    let lastTranscript = ""; // To store the last full transcript

    // Create the recognition stream
    recognizeStream = client
        .streamingRecognize(request)
        .on("error", console.error)
        .on("data", (data) => {
            lastSpokenTime = Date.now(); // Reset silence timer

            const result = data.results[0];
            const transcript = result?.alternatives[0]?.transcript;
            const isFinal = result?.isFinal;

            if (transcript && transcript !== lastTranscript) {
                onTranscript(transcript); // Pass the updated transcript to the callback
                lastTranscript = transcript;
            }

            if (isFinal) {
                // Final transcription callback
                lastSpokenTime = 0; // User doesn't speak
            }
        });

    if (process.env.NODE_ENV === "production") {
        // In production, use direct arecord spawn
        audioProcess = spawn("arecord", [
            "-D", "plug:shared_mic", // Use the specific audio device
            "-f", "S16_LE",
            "-r", "16000",
            "-c", "1",
            "-t", "raw",
        ]);

        audioProcess.stderr.on("data", (err) => {
            console.error("arecord error:", err.toString());
        });

        audioProcess.on("exit", (code) => {
            console.log("arecord exited with code", code);
        });

        // Pipe arecord output to Google STT
        audioProcess.stdout.pipe(recognizeStream);
    } else {
        // In development, use node-record-lpcm16
        audioStream = record
            .record({
                channels: 1, // Mono audio
                audioType: "raw", // Raw PCM data
                sampleRateHertz: 16000,
                threshold: 0, // Silence threshold
                verbose: false,
                recordProgram: "rec", // Use 'rec' for development
                recorder: "sox",
                device: null, // No specific device in development
            })
            .stream()
            .on("error", console.error);

        // Pipe the audio stream to the recognition stream
        audioStream.pipe(recognizeStream);
    }

    // Monitor silence
    const silenceChecker = setInterval(() => {
        if (Date.now() - lastSpokenTime > silenceTimeout) {
            clearInterval(silenceChecker); // Stop checking for silence

            // End recognition and stop recording
            recognizeStream.end();
            audioStream.destroy();
            onFinalResult(lastTranscript);
        }
    }, 300);
}

let currentStreamAbortController = null;

export async function synthesise(text, voiceName = "ash") {
    // Kill any currently playing audio
    if (currentPlayer) {
        currentPlayer.kill();
        currentPlayer = null;
    }

    // Abort any ongoing TTS stream
    if (currentStreamAbortController) {
        currentStreamAbortController.abort(); // this prevents further chunks from being read
        currentStreamAbortController = null;
    }

    currentStreamAbortController = new AbortController();
    const { signal } = currentStreamAbortController;

    const response = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        instructions: TTS_INSTRUCTIONS,
        voice: voiceName,
        input: text,
        response_format: "opus",
        signal,
    });

    const ffplay = spawn("ffplay", ["-i", "pipe:0", "-nodisp", "-autoexit"], {
        stdio: ["pipe", "ignore", "ignore"],
    });

    ffplay.stdin.on("error", (err) => {
        if (err.code === "EPIPE") {
            console.warn(
                "[synth] tried to write after ffplay was killed — ignoring."
            );
        } else {
            console.error("[synth] ffplay.stdin error:", err);
        }
    });

    currentPlayer = ffplay;

    try {
        for await (const chunk of response.body) {
            if (ffplay !== currentPlayer || signal.aborted) {
                // Stop early if interrupted
                break;
            }
            if (!ffplay.stdin.destroyed) {
                ffplay.stdin.write(chunk);
            }
        }
    } catch (err) {
        if (err.name !== "AbortError") {
            console.error("[synth] stream error:", err);
        }
    } finally {
        if (!ffplay.stdin.destroyed) {
            ffplay.stdin.end();
        }
        currentStreamAbortController = null;
    }

    return new Promise((resolve, reject) => {
        ffplay.on("close", (code) => {
            if (ffplay === currentPlayer) {
                currentPlayer = null;
                code === 0
                    ? resolve()
                    : reject(new Error(`ffplay exited with code ${code}`));
            }
        });
    });
}

// Example usage
// transcribeStream((chunk) => {
//     console.log(`${new Date()} Chunk: ${chunk}`);
// }, (transcript) => {
//     console.log(`\n${new Date()} Speech end. Final result: ${transcript}`)
// });

// synthesise('This is a test of the TTS service.', 'nova');
