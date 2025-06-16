const container = document.getElementById("uiContainer");
const appsContainer = document.getElementById("apps");
const screensaver = document.getElementById("screensaver");

// // Constants for timings
// const IDLE_FADE_TIME = 10000;                            // Seconds of idle required to start fading
// const SCREENSAVER_TIME = 15000;                          // Seconds of idle required to activate screensaver

// // debug values
// //const IDLE_FADE_TIME = 5000;                            // Seconds of idle required to start fading
// //const SCREENSAVER_TIME = 5500;                          // Seconds of idle required to activate screensaver
const FADE_DURATION = 5000; // Fade-out duration
const BLUR_AMOUNT = 10; // Maximum blur in pixels
const MIN_SCALE = 0.7; // Minimum scale of the container

// Track idle time and timeout IDs
let idleTimeout, screensaverTimeout, lowPowerTimeout;

// Set up the screensaver background
$("#screensaver canvas").gradient({
    colors: ["#a20000", "#1d82ff", "#701dff"],
});

let resettingContainer = false;
let screensaverActive = true;
// Function to reset idle time
async function resetIdleTimer() {
    const screensaverTime =
        (await window.backend.settings.get("power.timeScreensaver")) * 1000;
    console.log(screensaverTime);

    if (resettingContainer || openAnimationRunning) return;

    // Clear existing timeouts
    clearTimeout(idleTimeout);
    clearTimeout(screensaverTimeout);
    clearTimeout(lowPowerTimeout);

    // Restart idle timers
    idleTimeout = setTimeout(startFade, screensaverTime - FADE_DURATION);
    screensaverTimeout = setTimeout(activateScreensaver, screensaverTime);

    if (!screensaverActive) return;

    // Restore container properties if active animations are present
    anime.remove(container); // Cancel any ongoing animation
    anime.remove(appsContainer); // Cancel any ongoing animation
    resettingContainer = true;
    container.style.transition = "none";
    anime({
        targets: [container, appsContainer],
        scale: 1,
        opacity: [1],
        filter: "blur(0px)",
        duration: 500,
        easing: "easeOutQuad",
        complete: () => {
            container.style = "";

            appsContainer.style.transform = "";
            appsContainer.style.filter = "";
            appsContainer.style.opacity = "";

            resettingContainer = false;
            screensaverActive = false;
        },
    });

    // Deactivate screensaver
    screensaver.classList.remove("active");
}

// Function to start fading (blur, scale down, fade out) effect
function startFade() {
    closeKeyboard();

    screensaverActive = true;
    container.style.transition = "none";
    anime({
        targets: [container, appsContainer],
        scale: MIN_SCALE,
        filter: `blur(${BLUR_AMOUNT}px)`,
        opacity: 0.05,
        duration: FADE_DURATION, // Smooth transition to match screensaver timing
        easing: "easeInSine",
    });
}

// Function to activate the screensaver
async function activateScreensaver() {
    const lowPowerTime =
        (await window.backend.settings.get("power.timeLowPower")) * 1000;

    screensaverActive = true;
    container.style.transition = "";
    screensaver.classList.add("active");
    window.apollo.resetConversation();
    if (lowPowerTime > 0)
        lowPowerTimeout = setTimeout(activateLowPower, lowPowerTime);
}

function activateLowPower() {
    window.backend.misc.setLowPowerMode(true);
}

// Event listeners to reset idle time on user interactions
["mousemove", "keydown", "mousedown", "touchstart", "scroll"].forEach(
    (event) => {
        document.addEventListener(event, resetIdleTimer);
    }
);

// Initialize idle timer
resetIdleTimer();
