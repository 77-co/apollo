class SpotifyWidget {
    constructor() {
        this.integration = new Integration('spotify', () => {
            // Handle logging out (unlinking account)
            this.destroy(); // Call destroy first to clean up properly
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
        
        // Volume control elements
        this.volumeBar = this.widget.querySelector('.volume-bar');
        this.volumeFill = this.widget.querySelector('.volume-fill');
        this.volumeIcon = this.widget.querySelector('.volume-icon');
        this.volumePercentage = this.widget.querySelector('.volume-percentage');
        
        this.isPlaying = false;
        this.currentVolume = 50; // Default volume
        this.updateInterval = null;
        this.devicePollInterval = null;
        this.currentTrackId = null;
        this.animations = {};
        this.currentImageUrl = null;
        this.isDragging = false;
        this.isDestroyed = false; // Add flag to prevent operations after destroy

        this.device = null;
        
        // Initialize with opacity 0
        this.albumArt.style.opacity = '0';
        this.titleSpan.style.opacity = '0';
        this.authorSpan.style.opacity = '0';
        
        this.initializeSpotify();
        this.setupEventListeners();
        this.setupAnimations();
        this.setupVolumeControl();
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

    setupVolumeControl() {
        // Volume bar click and drag
        const handleVolumeChange = (e) => {
            if (this.isDestroyed) return; // Prevent operations after destroy
            const rect = this.volumeBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
            this.setVolume(Math.round(percentage));
        };

        // Click to set volume
        this.volumeBar.addEventListener('click', handleVolumeChange);

        // Drag to set volume
        this.volumeBar.addEventListener('mousedown', (e) => {
            if (this.isDestroyed) return;
            this.isDragging = true;
            handleVolumeChange(e);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && !this.isDestroyed) {
                handleVolumeChange(e);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Volume icon click to mute/unmute
        this.volumeIcon.addEventListener('click', () => {
            if (this.isDestroyed) return;
            if (this.currentVolume > 0) {
                this.previousVolume = this.currentVolume;
                this.setVolume(0);
            } else {
                this.setVolume(this.previousVolume || 50);
            }
        });

        // Initialize volume display
        this.updateVolumeDisplay(this.currentVolume);
    }

    async setVolume(volume) {
        if (this.isDestroyed) return;
        try {
            const response = await window.backend.spotify.setVolume(volume);
            if (response.success) {
                this.currentVolume = volume;
                this.updateVolumeDisplay(volume);
            }
        } catch (error) {
            console.error('Failed to set volume:', error);
        }
    }

    updateVolumeDisplay(volume) {
        if (this.isDestroyed) return;
        this.currentVolume = volume;
        this.volumeFill.style.width = `${volume}%`;
        this.volumePercentage.textContent = `${volume}%`;
        
        // Update volume icon based on level
        if (volume === 0) {
            this.volumeIcon.textContent = 'volume_off';
        } else if (volume < 30) {
            this.volumeIcon.textContent = 'volume_down';
        } else {
            this.volumeIcon.textContent = 'volume_up';
        }
    }

    async initializeSpotify() {
        if (this.isDestroyed) return;
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
        this.spotifyEventHandler = async (e) => {
            if (this.isDestroyed) return; // Ignore events after destroy
            
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
                    $(".spotifyLoginAlert").removeClass("active");
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
        };

        window.addEventListener('spotify-event', this.spotifyEventHandler);

        const controlButtons = [this.playButton, this.prevButton, this.nextButton];
        controlButtons.forEach(button => {
            button.addEventListener('click', this.debounce((e) => {
                if (this.isDestroyed) return;
                this.animations.buttonPress.targets = e.currentTarget;
                this.animations.buttonPress.play();
            }, 200));
        });

        this.playButton.addEventListener('click', this.debounce(() => {
            if (!this.isDestroyed) this.togglePlayback();
        }, 200));
        this.prevButton.addEventListener('click', this.debounce(() => {
            if (!this.isDestroyed) this.previousTrack();
        }, 200));
        this.nextButton.addEventListener('click', this.debounce(() => {
            if (!this.isDestroyed) this.nextTrack();
        }, 200));
    }

    async checkAndPollForDevices() {
        if (this.isDestroyed) return;
        
        const getDevice = async () => {
            if (this.isDestroyed) return null;
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
            if (this.isDestroyed) {
                clearInterval(this.devicePollInterval);
                return;
            }
            
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
        if (this.isDestroyed) return;
        console.log('Starting track updates');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateCurrentTrack();
        this.updateInterval = setInterval(() => {
            if (this.isDestroyed) {
                clearInterval(this.updateInterval);
                return;
            }
            this.updateCurrentTrack();
        }, 1000);
    }

    async togglePlayback() {
        if (this.isDestroyed) return;
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
        if (this.isDestroyed) return;
        const iconSpan = this.playButton.querySelector('span');
        iconSpan.textContent = this.isPlaying ? 'pause' : 'play_arrow';
    }

    async previousTrack() {
        if (this.isDestroyed) return;
        try {
            this.nextTrackFadeout();
            const response = await window.backend.spotify.previous();
        } catch (error) {
            console.error('Failed to play previous track:', error);
        }
    }

    async nextTrack() {
        if (this.isDestroyed) return;
        try {
            this.nextTrackFadeout();
            const response = await window.backend.spotify.next();
        } catch (error) {
            console.error('Failed to play next track:', error);
        }
    }

    nextTrackFadeout() {
        if (this.isDestroyed) return;
        $('#spotify .meta').addClass('paused');
        anime(this.animations.oldSongOut);
    }

    async updateCurrentTrack() {
        if (!this.device || this.isDestroyed) return;
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
                const state = stateResponse.result.state;
                const newIsPlaying = state.is_playing;
                
                // Update playback state
                if (this.isPlaying !== newIsPlaying) {
                    this.isPlaying = newIsPlaying;
                    this.updatePlayButton();
                }

                // Update volume if device supports it and volume changed
                if (state.device?.supports_volume && state.device?.volume_percent !== undefined) {
                    const deviceVolume = state.device.volume_percent;
                    if (deviceVolume !== this.currentVolume) {
                        this.updateVolumeDisplay(deviceVolume);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update current track:', error);
        }
    }

    async updateTrackContent(newTitle, newArtist, newImageUrl) {
        if (this.isDestroyed) return;
        this.titleSpan.textContent = newTitle;
        this.authorSpan.textContent = newArtist;

        if (newImageUrl) {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    if (!this.isDestroyed) {
                        this.albumArt.src = newImageUrl;
                        this.currentImageUrl = newImageUrl;
                    }
                    resolve();
                };
                img.onerror = reject;
                img.src = newImageUrl;
            });
        }

        if (!this.isDestroyed) {
            anime({
                complete: () => {
                    if (!this.isDestroyed) {
                        updateScrollWidth();
                        $('#spotify .meta').removeClass('paused');
                    }
                },
                ...this.animations.newSongIn
            });
        }
    }

    destroy() {
        // Set destroy flag to prevent further operations
        this.isDestroyed = true;
        
        // Clear intervals immediately
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.devicePollInterval) {
            clearInterval(this.devicePollInterval);
            this.devicePollInterval = null;
        }
        
        // Remove event listener
        if (this.spotifyEventHandler) {
            window.removeEventListener('spotify-event', this.spotifyEventHandler);
        }
        
        // Clear old QR code and integration data to force new auth session
        if (integrations['spotify']) {
            delete integrations['spotify'].qrcode;
            integrations['spotify'] = {};
        }
        
        // Reset UI state - show login alert, hide device alert
        $('.spotifyLoginAlert').addClass('active');
        $('.spotifyDeviceAlert').removeClass('active');
        
        // Reset widget state
        this.device = null;
        this.currentTrackId = null;
        this.currentImageUrl = null;
        this.isPlaying = false;
        this.isDragging = false;
        
        // Reset UI elements to initial state
        this.titleSpan.textContent = '';
        this.authorSpan.textContent = '';
        this.albumArt.src = 'https://placehold.co/512x512';
        this.albumArt.style.opacity = '0';
        this.titleSpan.style.opacity = '0';
        this.authorSpan.style.opacity = '0';
        
        // Reset controls
        this.updatePlayButton();
        this.updateVolumeDisplay(50);
        this.currentVolume = 50;
        
        // Remove paused class and reset meta
        $('#spotify .meta').removeClass('paused');
        
        // Stop animations
        Object.values(this.animations).forEach(animation => {
            if (animation && typeof animation.pause === 'function') {
                animation.pause();
            }
        });
        
        // Don't call window.backend.spotify.destroy() here since it's called by the integration
    }

    // Method to reinitialize when user wants to reconnect
    async reinitialize() {
        if (this.isDestroyed) {
            // Reset the destroyed state
            this.isDestroyed = false;
            
            // Re-setup event listeners
            this.setupEventListeners();
            
            // Initialize Spotify with fresh auth session
            await this.initializeSpotify();
        }
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