class Calendar {
    constructor() {
        this.initializeSpotify();
        this.setupEventListeners();
        this.setupAnimations();
    }

    async initializeSpotify() {
        try {
            const result = await window.backend.spotify.initialize();
            if (!result.success) {
                console.error('Spotify initialization failed:', result.error);
            }
        } catch (error) {
            console.error('Failed to initialize Spotify:', error);
        }
    }

    setupEventListeners() {
        window.addEventListener('calendar-event', async (e) => {
            const { event, data } = e.detail;
            
            switch (event) {
                case 'authInitialized':
                    if (data.qrCode) {
                        $('#spotifyLoginQRCode').attr('src', data.qrCode);
                        $('.spotifyLoginAlert').addClass('active');
                    }
                    break;

                case 'authUrlVisited':
                    $('#spotifyQrBlur').addClass('active');
                    break;

                case 'authenticated':
                    $('.spotifyLoginAlert').removeClass('active');
                    break;

                case 'ready':
                    console.log('Spotify ready, checking for devices...');
                    await this.checkAndPollForDevices();
                    break;

                case 'deviceSelected':
                    console.log('Device selected:', data.deviceId);
                    this.startTrackUpdates();
                    break;

                case 'error':
                    console.error('Spotify error:', data);
                    break;
            }
        });
    }
}