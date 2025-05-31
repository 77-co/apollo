function animaText(el) {
    const initialHTML = el.innerHTML;

    const textContent = el.textContent;

    el.innerHTML = textContent
        .split('') // Split the string into an array of characters
        .map(char => `<span style="display: inline-block;">${char}</span>`) // Wrap each character in a span
        .join(''); // Join the array back into a single string

    anime({
        targets: el.children,
        textShadow: [
            '0 0 10px rgba(255, 255, 255, 0.6)', // Bright glow at the start
            '0 0 5px rgba(255, 255, 255, 0.3)', // Dim glow mid-way
            '0 0 0px rgba(255, 255, 255, 0)' // No shadow at the end
        ],
        translateY: [40, 0], // Characters move upwards
        opacity: [0, 1], // Fade in
        easing: 'easeOutCubic',
        duration: 600, // Shortened duration for snappiness
        delay: anime.stagger(20), // Adjusted stagger for smoother flow
        complete: () => {
            // Bring back the initial HTML.
            el.innerHTML = initialHTML;
        }
    });
}

function generateSquircle(options = {}) {
    const { n = 4, steps = 64, aspectRatio = 1 } = options;

    const validatedN = Math.max(2, Math.min(8, n));
    const validatedSteps = Math.max(16, Math.min(256, Math.floor(steps)));
    const validatedAspectRatio = Math.max(0.1, aspectRatio);

    const points = [];

    for (let i = 0; i <= validatedSteps; i++) {
        const theta = (i / validatedSteps) * 2 * Math.PI;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const xExponent = 2 / validatedN;
        const yExponent = 2 / (validatedN * validatedAspectRatio);

        const xRaw = Math.sign(cos) * Math.pow(Math.abs(cos), xExponent);
        const yRaw = Math.sign(sin) * Math.pow(Math.abs(sin), yExponent);

        const x = 50 + 50 * xRaw;
        const y = 50 + 50 * yRaw;

        points.push(`${x.toFixed(3)}% ${y.toFixed(3)}%`);
    }

    return `polygon(${points.join(", ")})`;
}