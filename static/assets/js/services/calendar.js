class Calendar {
    constructor() {
        this.integration = new Integration('google');
        this.initializeGoogle();
        this.setupEventListeners();
        // this.setupAnimations();
    }

    async initializeGoogle() {
        try {
            const result = await window.backend.google.initialize();
            if (!result.success) {
                console.error('Google Calendar initialization failed:', result.error);
            }
        } catch (error) {
            console.error('Failed to initialize Google Calendar:', error);
        }
    }

    setupEventListeners() {
        window.addEventListener('calendar-event', async (e) => {
            const { event, data } = e.detail;
            
            switch (event) {
                case 'authInitialized':
                    if (data.qrCode) {
                        integrations['google'].qrcode = data.qrCode;
                    }
                    break;

                case 'authUrlVisited':
                    this.integration.confirmLogin();
                    break;

                case 'authenticated':
                    this.integration.finaliseLogin();
                    break;

                case 'ready':
                    console.log('Google ready.');
                    break;

                case 'error':
                    console.error('Google error:', data);
                    break;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.calendar = new Calendar();
});