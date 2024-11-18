window.backend.assistant.initialize()
    .then((response) => {
        if (response.success) {
            console.log('Assistant initialized successfully');
        } else {
            console.error('Error initializing Assistant:', response.error || 'Unknown error');
        }
    })
    .catch((error) => {
        console.error('Unexpected error during Assistant initialization:', error);
    });

class ApolloUI {
    constructor() {
        this.currentScreen = 'idle';
        this.messages = [];
        this.conversationId = null;
        this.examplePrompts = [
            "Apollo, jaka będzie dzisiaj pogoda w Poznaniu?",
            "Apollo, opowiedz mi żart",
            "Apollo, co nowego w technologii?",
            "Apollo, jak się masz?",
        ];
        this.currentPromptIndex = 0;
        this.isStreamingResponse = 0;

        this.setupEventListeners();
        this.startPromptCycle();
        this.setupAnimations();
    }

    setupEventListeners() {
        // Wake word detection
        window.addEventListener('wake-event', (e) => {
            const { event } = e.detail;
            if (event === 'wake' && !this.isStreamingResponse) {
                resetIdleTimer();
                this.startListening();
            }
        });

        // Speech events
        window.addEventListener('speech-event', (e) => {
            const { event, data } = e.detail;
            switch (event) {
                case 'chunk':
                    this.updateTranscript(data);
                    break;
                case 'finished':
                    this.handleFinishedSpeech(data);
                    break;
            }
        });
    }

    setupAnimations() {
        // Listening and Processing Animations
        this.listeningAnimation = anime.timeline({
            autoplay: false,
            targets: '.listening-processing-indicator .circle',
            loop: true,
            easing: 'easeInOutSine'
        }).add({
            scale: [1, 1.6, 1],
            opacity: [1, 0.4, 1],
            delay: anime.stagger(100),
            duration: 1000
        });

        // Processing all dots pulsing animation
        this.processingAnimation = anime.timeline({
            autoplay: false,
            targets: '.listening-processing-indicator .circle',
            loop: true,
            easing: 'easeInOutSine'
        }).add({
            scale: [1, 1.6, 1],
            opacity: 1,
            duration: 1000
        });
    }

    startPromptCycle() {
        const cycleExamplePrompts = () => {
            anime({
                targets: '#examplePrompt',
                opacity: [1, 0],
                duration: 500,
                easing: 'easeOutQuad',
                complete: () => {
                    this.currentPromptIndex = (this.currentPromptIndex + 1) % this.examplePrompts.length;
                    document.getElementById('examplePrompt').textContent = this.examplePrompts[this.currentPromptIndex];
                    anime({
                        targets: '#examplePrompt',
                        opacity: [0, 1],
                        duration: 500,
                        easing: 'easeInQuad'
                    });
                }
            });
        };

        cycleExamplePrompts();
        setInterval(cycleExamplePrompts, 3000);
    }

    switchScreen(screenName) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));

        const newScreen = document.querySelector(`.${screenName}Screen`);
        newScreen.classList.add('active');

        this.currentScreen = screenName;
    }

    startListening() {
        document.querySelectorAll('.prompt-intro')[1].textContent = 'Słucham...';
        this.switchScreen('listeningProcessing');

        // Start listening animation
        const circles = document.querySelectorAll('.listening-processing-indicator .circle');
        circles.forEach((circle, index) => {
            circle.classList.remove('processing-dot');
            circle.style.transform = '';
            circle.style.opacity = '1';
        });
        this.listeningAnimation.restart();

        window.backend.speech.transcribeStream();
    }

    updateTranscript(text) {
        const transcript = document.getElementById('transcript');
        transcript.textContent = text;
    }

    async handleFinishedSpeech(finalTranscript) {
        if (finalTranscript.length === 0) { // If no speech was detected
            if (this.conversationId) {
                // If there is an active conversation, switch back to chat screen.
                this.switchScreen('chat');
            } else {
                // If there is no active conversation, call resetConversation() as it will ensure everything is cleaned and switch back to the idle screen.
                this.resetConversation();
            }

            return;
        }

        // Transition from listening to processing
        const circles = document.querySelectorAll('.listening-processing-indicator .circle');

        // First animation: transform circles
        anime.timeline()
            .add({
                targets: circles,
                scale: [1, 0.6],
                opacity: [1, 0.6],
                duration: 300,
                easing: 'easeInOutQuad',
                complete: () => {
                    // Add processing class
                    circles.forEach((circle, index) => {
                        circle.classList.add('processing-dot');
                    });
                }
            })
            .add({
                targets: '.prompt-intro',
                opacity: [1, 0],
                translateY: [0, -10],
                easing: 'easeOutQuad',
                duration: 300,
                complete: () => {
                    document.querySelectorAll('.prompt-intro')[1].textContent = 'Przetwarzam...';
                    anime({
                        targets: '.prompt-intro',
                        opacity: [0, 1],
                        translateY: [10, 0],
                        easing: 'easeOutQuad',
                        duration: 300
                    });
                }
            });

        // Stop listening animation, start processing
        this.listeningAnimation.pause();
        this.processingAnimation.restart();

        await this.handleQuery(finalTranscript);
    }

    async handleQuery(query) {
        // Generate conversation ID if it's the first query
        if (!this.conversationId) {
            this.conversationId = 'conv-' + Math.random().toString(36).substr(2, 9);
        }

        // Ensure messages are added before switching screens
        this.addMessage('user', query);

        try {
            const streamId = 'apollo-response-' + Date.now();
            let currentResponse = '';

            // Add assistant message immediately 
            this.addMessage('assistant', '');

            // Show typing indicator
            document.getElementById('typingIndicator').classList.remove('hidden');

            // Listen for streaming chunks
            const chunkListener = (e) => {
                const chunk = e.detail;
                if (currentResponse.length === 0) { // If this is the first chunk
                    // Switch to chat screen before starting the message.
                    this.switchScreen('chat');
                }

                if (chunk.content) {
                    currentResponse += chunk.content;
                    this.updateLastAssistantMessage(currentResponse);
                }
            };
            window.addEventListener(streamId + '-assistant-chunk', chunkListener);

            // Stream the message
            this.isStreamingResponse = true;
            await window.backend.assistant.streamMessage(query, streamId, this.conversationId);
            this.isStreamingResponse = false;

            // Remove chunk listener
            window.removeEventListener(streamId + '-assistant-chunk', chunkListener);

            // Hide typing indicator
            document.getElementById('typingIndicator').classList.add('hidden');

            // Clear the previous transcript
            this.updateTranscript('');

            // Synthesize the full response
            window.backend.speech.synthesize(currentResponse);
        } catch (error) {
            console.error('Error getting response:', error);
            document.getElementById('typingIndicator').classList.add('hidden');
            this.updateLastAssistantMessage('Przepraszam, wystąpił błąd. Spróbuj ponownie.');
        }
    }

    // New method to reset conversation
    resetConversation() {
        // Clear messages
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';

        // Reset conversation ID
        this.conversationId = null;

        // Switch back to idle screen
        this.switchScreen('idle');
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;

        if (role === 'assistant' && !content) {
            // Add typing indicator inside the message
            messageElement.innerHTML = `
            <span class="message-content"></span>
            <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        } else {
            messageElement.innerHTML = `<span class="message-content">${content}</span>`;
        }

        messagesContainer.appendChild(messageElement);

        // Scroll to bottom
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    updateLastAssistantMessage(content) {
        const messages = document.querySelectorAll('.message.assistant');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const messageContent = lastMessage.querySelector('.message-content');
            const typingIndicator = lastMessage.querySelector('.typing-indicator');

            // For the first chunk, remove typing indicator
            if (typingIndicator && !messageContent.textContent) {
                typingIndicator.remove();
            }

            // Create and append new animated span for the chunk
            const chunkSpan = document.createElement('span');
            chunkSpan.className = 'animated-word';
            chunkSpan.textContent = content.slice(messageContent.textContent.length); // Only new content
            messageContent.appendChild(chunkSpan);

            // Animate the new chunk
            anime({
                targets: chunkSpan,
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutQuad'
            });

            // Scroll to bottom
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.apollo = new ApolloUI();
    // window.apollo.switchScreen('listeningProcessing')
});