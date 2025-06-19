/*
    This utility works only in production environment 
    and is made to control the official Raspberry Pi 
    7-inch touch display.

    If used in a development environment, it will only
    print out the changes that would be made for debugging
    purposes.
*/

import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Global variable for easing frequency (milliseconds between steps)
const EASING_FREQUENCY = 100;

const DISPLAY_ID = process.env.DISPLAY_ID || "rpi_backlight"; // Default to Raspberry Pi display

// Path to the brightness control file
const BRIGHTNESS_PATH = `/sys/class/backlight/${DISPLAY_ID}/brightness`;
const MAX_BRIGHTNESS_PATH = `/sys/class/backlight/${DISPLAY_ID}/max_brightness`;

// Cache for current brightness and max brightness
let currentBrightness = null;
let maxBrightness = null;
let isTransitioning = false;

/**
 * Cubic easing function: 1 - (1 - x)^3
 * @param {number} x - Progress value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 */
function cubicEaseOut(x) {
    return 1 - Math.pow(1 - x, 3);
}

/**
 * Get the maximum brightness value supported by the display
 * @returns {Promise<number>} Maximum brightness value
 */
export async function getMaxBrightness() {
    if (maxBrightness !== null) {
        return maxBrightness;
    }

    try {
        const data = await fs.readFile(MAX_BRIGHTNESS_PATH, "utf8");
        maxBrightness = parseInt(data.trim());
        return maxBrightness;
    } catch (error) {
        console.error("Failed to read max brightness:", error.message);
        // Default fallback value for Raspberry Pi touch display
        maxBrightness = 255;
        return maxBrightness;
    }
}

/**
 * Get the current brightness value
 * @returns {Promise<number>} Current brightness value
 */
export async function getCurrentBrightness() {
    try {
        const data = await fs.readFile(BRIGHTNESS_PATH, "utf8");
        currentBrightness = parseInt(data.trim());
        return currentBrightness;
    } catch (error) {
        console.error("Failed to read current brightness:", error.message);
        return 0;
    }
}

/**
 * Write brightness value to the system file using sudo
 * @param {number} brightness - Brightness value to set
 * @returns {Promise<void>}
 */
async function writeBrightness(brightness) {
    const command = `echo ${brightness} | sudo tee ${BRIGHTNESS_PATH}`;

    try {
        await execAsync(command);
        currentBrightness = brightness;
    } catch (error) {
        throw new Error(`Failed to set brightness: ${error.message}`);
    }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Set the display brightness with easing animation
 * @param {number} targetBrightness - Target brightness (0-100 percentage or absolute value)
 * @param {number} [duration=1000] - Duration of the transition in milliseconds
 * @returns {Promise<void>}
 */
export async function setBrightness(targetBrightness, duration = 1000) {
    // Do nothing if not in production environment
    if (process.env.NODE_ENV !== "production") {
        console.log(
            `[DEV MODE] Would set brightness to ${targetBrightness}% over ${duration}ms`
        );
        return;
    }

    // Prevent multiple simultaneous transitions
    if (isTransitioning) {
        console.log(
            "Brightness transition already in progress, ignoring new request"
        );
        return;
    }

    try {
        isTransitioning = true;

        // Get system values
        const maxBright = await getMaxBrightness();
        const startBrightness = await getCurrentBrightness();

        // Convert percentage to absolute value if needed
        let targetAbsolute;
        if (targetBrightness <= 1) {
            // Treat as percentage (0-1)
            targetAbsolute = Math.round(targetBrightness * maxBright);
        } else if (targetBrightness <= 100) {
            // Treat as percentage (0-100)
            targetAbsolute = Math.round((targetBrightness / 100) * maxBright);
        } else {
            // Treat as absolute value
            targetAbsolute = Math.min(targetBrightness, maxBright);
        }

        // Clamp target value
        targetAbsolute = Math.max(0, Math.min(targetAbsolute, maxBright));

        console.log(
            `Setting brightness from ${startBrightness} to ${targetAbsolute} (max: ${maxBright}) over ${duration}ms`
        );

        // If target equals current, no transition needed
        if (startBrightness === targetAbsolute) {
            console.log(
                "Target brightness equals current brightness, no change needed"
            );
            return;
        }

        // Calculate transition parameters
        const brightnessDiff = targetAbsolute - startBrightness;
        const steps = Math.max(1, Math.floor(duration / EASING_FREQUENCY));
        const stepDuration = duration / steps;

        // Perform eased transition
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const easedProgress = cubicEaseOut(progress);
            const currentTargetBrightness = Math.round(
                startBrightness + brightnessDiff * easedProgress
            );

            await writeBrightness(currentTargetBrightness);

            // Don't sleep after the last step
            if (i < steps) {
                await sleep(stepDuration);
            }
        }

        console.log(`Brightness transition completed: ${targetAbsolute}`);
    } catch (error) {
        console.error("Error during brightness transition:", error.message);
        throw error;
    } finally {
        isTransitioning = false;
    }
}

// Example usage if run directly
// if (require.main === module) {
//     // Test the function
//     (async () => {
//         try {
//             console.log("Testing brightness control...");

//             // Set to 50% brightness over 2 seconds
//             await setBrightness(50, 2000);

//             // Wait a moment
//             await sleep(3000);

//             // Set to 100% brightness over 1 second
//             await setBrightness(100, 1000);
//         } catch (error) {
//             console.error("Test failed:", error.message);
//         }
//     })();
// }