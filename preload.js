const { contextBridge, ipcRenderer } = require('electron');

const AssistantService = {
    initialize: () => {
        // Handle speech module events.
        ipcRenderer.on('speech-event', (_, { event, data }) => {
            window.dispatchEvent(new CustomEvent('speech-event', {
                detail: { event, data }
            }));
        });

        // Handle wake word module events.
        ipcRenderer.on('wake-event', (_, { event, data }) => {
            window.dispatchEvent(new CustomEvent('wake-event', {
                detail: { event, data }
            }));
        });

        return ipcRenderer.invoke('initialize-assistant');
    },

    sendMessage: (message, conversationId, options) =>
        ipcRenderer.invoke('send-message', message, conversationId, options),

    clearConversation: (conversationId) =>
        ipcRenderer.invoke('clear-conversation', conversationId),

    listModels: () =>
        ipcRenderer.invoke('list-models'),

    streamMessage: (message, id, conversationId = null, options = {}) => {
        return new Promise((resolve, reject) => {
            const handleChunk = (_, chunk) => {
                window.dispatchEvent(new CustomEvent(id + '-assistant-chunk', {
                    detail: chunk
                }));
            };

            const cleanup = () => {
                ipcRenderer.removeListener('stream-chunk', handleChunk);
                ipcRenderer.removeListener('stream-end', handleEnd);
                ipcRenderer.removeListener('stream-error', handleError);
            };

            const handleEnd = () => {
                cleanup();
                resolve();
            };

            const handleError = (_, error) => {
                cleanup();
                reject(new Error(error));
            };

            ipcRenderer.on('stream-chunk', handleChunk);
            ipcRenderer.once('stream-end', handleEnd);
            ipcRenderer.once('stream-error', handleError);

            ipcRenderer.send('stream-message', message, conversationId, options);
        });
    }
};

const WeatherService = {
    getCurrentWeather: (params) =>
        ipcRenderer.invoke('get-weather', params),

    getForecast: (location, units = 'celsius', days = 5) =>
        ipcRenderer.invoke('get-weather-forecast', location, units, days),

    getHistorical: (location, units = 'celsius', days = 5) =>
        ipcRenderer.invoke('get-weather-historical', location, units, days),

    getComplete: (params) =>
        ipcRenderer.invoke('get-weather-complete', params)
};

const SpotifyService = {
    initialize: (config) => {
        ipcRenderer.on('spotify-event', (_, { event, data }) => {
            window.dispatchEvent(new CustomEvent('spotify-event', {
                detail: { event, data }
            }));
        });
        return ipcRenderer.invoke('initialize-spotify', config);
    },

    destroy: () => {
        ipcRenderer.removeAllListeners('spotify-event');
        return ipcRenderer.invoke('spotify-destroy');
    },

    play: (options) => ipcRenderer.invoke('spotify-play', options),
    pause: () => ipcRenderer.invoke('spotify-pause'),
    next: () => ipcRenderer.invoke('spotify-next'),
    previous: () => ipcRenderer.invoke('spotify-previous'),
    seek: (positionMs) => ipcRenderer.invoke('spotify-seek', positionMs),
    setVolume: (volumePercent) => ipcRenderer.invoke('spotify-set-volume', volumePercent),
    setRepeat: (state) => ipcRenderer.invoke('spotify-set-repeat', state),
    setShuffle: (state) => ipcRenderer.invoke('spotify-set-shuffle', state),

    getCurrentState: () => ipcRenderer.invoke('spotify-get-current-state'),
    getCurrentTrack: () => ipcRenderer.invoke('spotify-get-current-track'),
    getQueue: () => ipcRenderer.invoke('spotify-get-queue'),

    search: (query, types, options) => 
        ipcRenderer.invoke('spotify-search', query, types, options),
    getPlaylists: (limit, offset) => 
        ipcRenderer.invoke('spotify-get-playlists', limit, offset),
    createPlaylist: (userId, name, options) => 
        ipcRenderer.invoke('spotify-create-playlist', userId, name, options),
    addToPlaylist: (playlistId, uris, options) => 
        ipcRenderer.invoke('spotify-add-to-playlist', playlistId, uris, options),

    getDevices: () => ipcRenderer.invoke('spotify-get-devices'),
    setDevice: (deviceId) => ipcRenderer.invoke('spotify-set-device', deviceId),
    addToQueue: (uri) => ipcRenderer.invoke('spotify-add-to-queue', uri)
};

const SpeechService = {
    transcribeStream: () => 
        ipcRenderer.invoke('speech-transcribe-stream'),
    synthesize: (text) =>
        ipcRenderer.invoke('speech-synthesize', text),
};

const settings = {
    set: (key, value) =>
        ipcRenderer.invoke('setting-set', key, value),
    get: (key) =>
        ipcRenderer.invoke('setting-get', key),
}

const misc = {
    setDarkTheme: (darkTheme) => 
        ipcRenderer.invoke('misc-set-dark-theme', darkTheme),
    getDarkTheme: () => 
        ipcRenderer.invoke('misc-get-dark-theme'),
};

contextBridge.exposeInMainWorld('backend', {
    assistant: AssistantService,
    weather: WeatherService,
    spotify: SpotifyService,
    speech: SpeechService,
    settings,
});