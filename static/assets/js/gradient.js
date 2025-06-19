function createCSSGradientAnimation() {
    const systemVersionElement = document.getElementById('systemVersion');
    if (!systemVersionElement) return;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes textShine {
            0% {
                background-position: 0% 50%;
            }
            25% {
                background-position: 50% 50%;
            }
            50% {
                background-position: 100% 50%;
            }
            75% {
                background-position: 50% 50%;
            }
            100% {
                background-position: 0% 50%;
            }
        }
        
        .gradient-text-shine {
            background: linear-gradient(
                45deg,
                #ff6b6b 0%,
                #4ecdc4 15%,
                #45b7d1 25%,
                #96ceb4 35%,
                #ffeaa7 45%,
                #dda0dd 55%,
                #fd79a8 65%,
                #fdcb6e 75%,
                #6c5ce7 85%,
                #74b9ff 100%
            );
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            background-size: 400% 400%;
            animation: textShine 16s ease-in-out infinite;
            font-weight: bold;
            text-shadow: none;
        }
    `;
    
    document.head.appendChild(style);
    systemVersionElement.classList.add('gradient-text-shine');
    systemVersionElement.innerHTML = systemVersionElement.textContent;
}

setTimeout(createCSSGradientAnimation, 100);