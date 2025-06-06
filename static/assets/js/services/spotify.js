class SpotifyWidget {
    constructor() {
        this.integration = new Integration('spotify', () => {
            // Handle logging out (unlinking account)
            window.backend.spotify.destroy();
            window.backend.integrations.deintegrate("spotify");
        });

        this.widget = document.getElementById('spotify');
        this.albumArt = this.widget.querySelector('img');
        this.titleSpan = this.widget.querySelector('.title .text');
        this.authorSpan = this.widget.querySelector('.author .text');
        this.playButton = this.widget.querySelector('.controls button:nth-child(2)');
        this.prevButton = this.widget.querySelector('.controls button:nth-child(1)');
        this.nextButton = this.widget.querySelector('.controls button:nth-child(3)');
        
        this.isPlaying = false;
        this.updateInterval = null;
        this.devicePollInterval = null;
        this.currentTrackId = null;
        this.animations = {};
        this.currentImageUrl = null;

        this.device = null;
        
        // Initialize with opacity 0
        this.albumArt.style.opacity = '0';
        this.titleSpan.style.opacity = '0';
        this.authorSpan.style.opacity = '0';
        
        this.initializeSpotify();
        this.setupEventListeners();
        this.setupAnimations();
    }

    setupAnimations() {
        // Track change animation
        this.animations.trackChange = anime.timeline({
            autoplay: false,
            duration: 300,
            easing: 'easeInOutQuad'
        });

        // Button press animation
        this.animations.buttonPress = anime({
            targets: null,
            scale: [1, 0.95, 1],
            duration: 200,
            easing: 'easeInOutQuad',
            autoplay: false
        });

        this.animations.newSongIn = {
            targets: [this.titleSpan, this.authorSpan, this.albumArt],
            opacity: [0, 1],
            translateX: [25, 0],
            duration: 150,
            easing: 'easeOutSine'
        };

        this.animations.oldSongOut = {
            targets: [this.titleSpan, this.authorSpan, this.albumArt],
            opacity: [1, 0],
            translateX: [0, -25],
            duration: 150,
            easing: 'easeInSine'
        };
    }

    async initializeSpotify() {
        try {
            const result = await window.backend.spotify.initialize();
            if (!result.success) {
                console.error('Spotify initialization failed:', result.error);
            } else {
                $(".spotifyLoginAlert").removeClass("active");
            }
        } catch (error) {
            console.error('Failed to initialize Spotify:', error);
        }
    }

    setupEventListeners() {
        window.addEventListener('spotify-event', async (e) => {
            const { event, data } = e.detail;
            
            switch (event) {
                case 'authInitialized':
                    if (data.qrCode) {
                        integrations['spotify'].qrcode = data.qrCode;
                    }
                    break;

                case 'authUrlVisited':
                    this.integration.confirmLogin();
                    break;

                case 'authenticated':
                    this.integration.finaliseLogin();
                    break;

                case 'ready':
                    console.log('Spotify ready, checking for devices...');
                    this.integration.finaliseLogin();
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

        const controlButtons = [this.playButton, this.prevButton, this.nextButton];
        controlButtons.forEach(button => {
            button.addEventListener('click', this.debounce((e) => {
                this.animations.buttonPress.targets = e.currentTarget;
                this.animations.buttonPress.play();
            }, 200));
        });

        this.playButton.addEventListener('click', this.debounce(() => this.togglePlayback(), 200));
        this.prevButton.addEventListener('click', this.debounce(() => this.previousTrack(), 200));
        this.nextButton.addEventListener('click', this.debounce(() => this.nextTrack(), 200));
    }

    async checkAndPollForDevices() {
        const getDevice = async () => {
            try {
                const response = await window.backend.spotify.getDevices();
                // console.log('Devices:', response);
                if (response.success && response.result?.devices?.length > 0) {
                    const device = response.result.devices[0];
                    await this.startTrackUpdates();
                    this.device = device;
                    return device;
                }
                return null;
            } catch (error) {
                console.error('Error checking devices:', error);
                return null;
            }
        };

        this.devicePollInterval = setInterval(async () => {
            const device = await getDevice();
            this.device = device;
            if (device) {
                $('.spotifyDeviceAlert').removeClass('active');
            } else {
                $('.spotifyDeviceAlert').addClass('active');
            }
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    startTrackUpdates() {
        console.log('Starting track updates');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateCurrentTrack();
        this.updateInterval = setInterval(() => this.updateCurrentTrack(), 1000);
    }

    async togglePlayback() {
        try {
            this.isPlaying = !this.isPlaying;
            this.updatePlayButton();
            
            const response = this.isPlaying ? 
                await window.backend.spotify.play() :
                await window.backend.spotify.pause();
                
            if (!response.success) {
                this.isPlaying = !this.isPlaying;
                this.updatePlayButton();
            }
        } catch (error) {
            this.isPlaying = !this.isPlaying;
            this.updatePlayButton();
            console.error('Failed to toggle playback:', error);
        }
    }

    updatePlayButton() {
        const iconSpan = this.playButton.querySelector('span');
        iconSpan.textContent = this.isPlaying ? 'pause' : 'play_arrow';
    }

    async previousTrack() {
        try {
            this.nextTrackFadeout();
            const response = await window.backend.spotify.previous();
        } catch (error) {
            console.error('Failed to play previous track:', error);
        }
    }

    async nextTrack() {
        try {
            this.nextTrackFadeout();
            const response = await window.backend.spotify.next();
        } catch (error) {
            console.error('Failed to play next track:', error);
        }
    }

    nextTrackFadeout() {
        $('#spotify .meta').addClass('paused');
        anime(this.animations.oldSongOut);
    }

    async updateCurrentTrack() {
        if (!this.device) return;
        try {
            const [trackResponse, stateResponse] = await Promise.all([
                window.backend.spotify.getCurrentTrack(),
                window.backend.spotify.getCurrentState()
            ]);

            if (trackResponse?.success && trackResponse?.result?.track) {
                const track = trackResponse.result.track;
                
                if (this.currentTrackId !== track.item?.id) {
                    this.currentTrackId = track.item?.id;
                    
                    const newTitle = track.item?.name || 'Nieznana ścieżka';
                    const newArtist = track.item?.artists?.map(artist => 
                        artist.name).join(', ') || 'Nieznany artysta';
                    
                    let newImageUrl = null;
                    if (track.item?.album?.images?.length > 0) {
                        const smallestImage = track.item.album.images.reduce((prev, current) =>
                            (!prev || current.width < prev.width) ? current : prev
                        );
                        newImageUrl = smallestImage.url;
                    }

                    if (newImageUrl && newImageUrl !== this.currentImageUrl) {
                        await this.updateTrackContent(newTitle, newArtist, newImageUrl);
                    } else {
                        await this.updateTrackContent(newTitle, newArtist, null);
                    }
                }
            }

            if (stateResponse?.success && stateResponse?.result?.state) {
                const newIsPlaying = stateResponse.result.state.is_playing;
                if (this.isPlaying !== newIsPlaying) {
                    this.isPlaying = newIsPlaying;
                    this.updatePlayButton();
                }
            }
        } catch (error) {
            console.error('Failed to update current track:', error);
        }
    }

    async updateTrackContent(newTitle, newArtist, newImageUrl) {
        this.titleSpan.textContent = newTitle;
        this.authorSpan.textContent = newArtist;

        if (newImageUrl) {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.albumArt.src = newImageUrl;
                    this.currentImageUrl = newImageUrl;
                    resolve();
                };
                img.onerror = reject;
                img.src = newImageUrl;
            });
        }

        anime({
            complete: () => {
                updateScrollWidth();
                $('#spotify .meta').removeClass('paused');
            },
            ...this.animations.newSongIn
        });
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.devicePollInterval) {
            clearInterval(this.devicePollInterval);
        }
        
        Object.values(this.animations).forEach(animation => {
            if (animation.pause) animation.pause();
        });
        this.animations = {};
        
        window.backend.spotify.destroy()
            .catch(error => console.error('Failed to destroy Spotify client:', error));
    }
}

// Function to update scroll width for each text element
function updateScrollWidth() {
    document.querySelectorAll('#spotify .meta span').forEach(container => {
        const text = container.querySelector('.text');
        if (text && container.scrollWidth > container.clientWidth) {
            const scrollAmount = -(text.offsetWidth - container.offsetWidth);
            container.style.setProperty('--scroll-width', `${scrollAmount}px`);
        } else {
            container.style.setProperty('--scroll-width', '');
        }
    });

    $('#spotify .meta .text').removeClass('animate');
    setTimeout(() => {
        $('#spotify .meta .text').addClass('animate');
    }, 1);
}

// Update on load and whenever content changes
window.addEventListener('load', updateScrollWidth);
window.addEventListener('resize', updateScrollWidth);

document.addEventListener('DOMContentLoaded', () => {
    window.spotifyWidget = new SpotifyWidget();
});