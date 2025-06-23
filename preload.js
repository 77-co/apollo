const { contextBridge, ipcRenderer, ipcMain } = require('electron');

const AssistantService = {
    initialize: () => {
        // Handle speech module events.
        ipcRenderer.on("speech-event", (_, { event, data }) => {
            window.dispatchEvent(
                new CustomEvent("speech-event", {
                    detail: { event, data },
                })
            );
        });

        // Handle wake word module events.
        ipcRenderer.on("wake-event", (_, { event, data }) => {
            window.dispatchEvent(
                new CustomEvent("wake-event", {
                    detail: { event, data },
                })
            );
        });

        return ipcRenderer.invoke("initialize-assistant");
    },

    sendMessage: (message, conversationId, options) =>
        ipcRenderer.invoke("send-message", message, conversationId, options),

    clearConversation: (conversationId) =>
        ipcRenderer.invoke("clear-conversation", conversationId),

    listModels: () => ipcRenderer.invoke("list-models"),

    createRealtimeSession: () => ipcRenderer.invoke("create-realtime-session"),

    streamMessage: (message, id, conversationId = null, options = {}) => {
        return new Promise((resolve, reject) => {
            const handleChunk = (_, chunk) => {
                window.dispatchEvent(
                    new CustomEvent(id + "-assistant-chunk", {
                        detail: chunk,
                    })
                );
            };

            const cleanup = () => {
                ipcRenderer.removeListener("stream-chunk", handleChunk);
                ipcRenderer.removeListener("stream-end", handleEnd);
                ipcRenderer.removeListener("stream-error", handleError);
            };

            const handleEnd = () => {
                cleanup();
                resolve();
            };

            const handleError = (_, error) => {
                cleanup();
                reject(new Error(error));
            };

            ipcRenderer.on("stream-chunk", handleChunk);
            ipcRenderer.once("stream-end", handleEnd);
            ipcRenderer.once("stream-error", handleError);

            ipcRenderer.send(
                "stream-message",
                message,
                conversationId,
                options
            );
        });
    },
};

// Add this to your preload services

const StockService = {
    // Quote methods
    getQuote: (symbol) =>
        ipcRenderer.invoke('stock-get-quote', symbol),

    getQuotes: (symbols) =>
        ipcRenderer.invoke('stock-get-quotes', symbols),

    getHistoricalData: (symbol, options = {}) =>
        ipcRenderer.invoke('stock-get-historical', symbol, options),

    search: (query, options = {}) =>
        ipcRenderer.invoke('stock-search', query, options),

    getMarketSummary: () =>
        ipcRenderer.invoke('stock-get-market-summary'),

    // Watchlist methods
    addToWatchlist: (symbol) =>
        ipcRenderer.invoke('stock-add-to-watchlist', symbol),

    removeFromWatchlist: (symbol) =>
        ipcRenderer.invoke('stock-remove-from-watchlist', symbol),

    getWatchlist: () =>
        ipcRenderer.invoke('stock-get-watchlist'),

    getWatchlistQuotes: () =>
        ipcRenderer.invoke('stock-get-watchlist-quotes'),

    // Portfolio methods
    createPortfolio: (name, description = '') =>
        ipcRenderer.invoke('stock-create-portfolio', name, description),

    addToPortfolio: (portfolioId, symbol, shares, purchasePrice, purchaseDate) =>
        ipcRenderer.invoke('stock-add-to-portfolio', portfolioId, symbol, shares, purchasePrice, purchaseDate),

    getPortfolioValue: (portfolioId) =>
        ipcRenderer.invoke('stock-get-portfolio-value', portfolioId),

    getPortfolios: () =>
        ipcRenderer.invoke('stock-get-portfolios'),

    // Utility methods
    isMarketOpen: (exchange = 'NYSE') =>
        ipcRenderer.invoke('stock-is-market-open', exchange),

    clearCache: () =>
        ipcRenderer.invoke('stock-clear-cache'),

    getCacheStats: () =>
        ipcRenderer.invoke('stock-get-cache-stats'),

    getBulkQuotes: (symbols, batchSize = 10) =>
        ipcRenderer.invoke('stock-bulk-quotes', symbols, batchSize),
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

const AirQualityService = {
    getCurrent: (params) =>
        ipcRenderer.invoke('get-air-quality', params),

    getForecast: (location, days = 4) =>
        ipcRenderer.invoke('get-air-quality-forecast', location, days),

    getHistorical: (location, days = 5) =>
        ipcRenderer.invoke('get-air-quality-historical', location, days),

    getComplete: (params) =>
        ipcRenderer.invoke('get-air-quality-complete', params)
};

const SpotifyService = {
    _eventListenersAttached: false,
    
    _attachEventListeners: function() {
        if (this._eventListenersAttached) return;
        
        // Use a named function so we can reference it for removal
        this._handleSpotifyEvent = (_, { event, data }) => {
            window.dispatchEvent(new CustomEvent('spotify-event', {
                detail: { event, data }
            }));
        };
        
        ipcRenderer.on('spotify-event', this._handleSpotifyEvent);
        this._eventListenersAttached = true;
    },
    
    initialize: function(config) {
        // Always ensure event listeners are attached
        this._attachEventListeners();
        return ipcRenderer.invoke('initialize-spotify', config);
    },

    destroy: function() {
        // Don't remove listeners on destroy, just tell the backend to clean up
        return ipcRenderer.invoke('spotify-destroy');
    },

    // Add a method to explicitly detach listeners when app is shutting down
    detachListeners: function() {
        if (this._eventListenersAttached && this._handleSpotifyEvent) {
            ipcRenderer.removeListener('spotify-event', this._handleSpotifyEvent);
            this._eventListenersAttached = false;
        }
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

const CalendarService = {
    _eventListenersAttached: false,
    
    _attachEventListeners: function() {
        if (this._eventListenersAttached) return;
        
        // Use a named function so we can reference it for removal
        this._handleCalendarEvent = (_, { event, data }) => {
            window.dispatchEvent(new CustomEvent('calendar-event', {
                detail: { event, data }
            }));
        };
        
        ipcRenderer.on('calendar-event', this._handleCalendarEvent);
        this._eventListenersAttached = true;
    },
    
    initialize: function(config) {
        // Always ensure event listeners are attached
        this._attachEventListeners();
        return ipcRenderer.invoke('initialize-calendar', config);
    },

    destroy: function() {
        // Don't remove listeners on destroy, just tell the backend to clean up
        return ipcRenderer.invoke('calendar-destroy');
    },

    // Add a method to explicitly detach listeners when app is shutting down
    detachListeners: function() {
        if (this._eventListenersAttached && this._handleCalendarEvent) {
            ipcRenderer.removeListener('calendar-event', this._handleCalendarEvent);
            this._eventListenersAttached = false;
        }
    },

    getUpcomingEvents: () => ipcRenderer.invoke("calendar-get-upcoming-events"),
};

const SpeechService = {
    transcribeStream: () => ipcRenderer.invoke("speech-transcribe-stream"),
    synthesise: (text) => ipcRenderer.invoke("speech-synthesise", text),
    killPlayer: () => ipcRenderer.invoke("speech-kill-player"),
};

const settings = {
    set: (key, value) =>
        ipcRenderer.invoke('setting-set', key, value),
    get: (key) =>
        ipcRenderer.invoke('setting-get', key),
};

const memos = {
    create: (title, value) =>
        ipcRenderer.invoke('memo-create', title, value),
    setTitle: (noteIndex, value) =>
        ipcRenderer.invoke('memo-title-set', noteIndex, value),
    setContent: (noteIndex, value) =>
        ipcRenderer.invoke('memo-content-set', noteIndex, value),
    get: () =>
        ipcRenderer.invoke('memos-get'),
};

const misc = {
    // setDarkTheme: (darkTheme) => 
    //     ipcRenderer.invoke('misc-set-dark-theme', darkTheme),
    // getDarkTheme: () => 
    //     ipcRenderer.invoke('misc-get-dark-theme'),
    setLowPowerMode: (enabled) => 
        ipcRenderer.invoke('misc-set-low-power-mode', enabled),
};

const system = { 
    wifi: {
        connect: (ssid, password) =>
            ipcRenderer.invoke('wifi-connect', ssid, password),
        disconnect: () =>
            ipcRenderer.invoke('wifi-disconnect'),
        listNetworks: () =>
            ipcRenderer.invoke('wifi-list-networks'),
    },
};

const MobidziennikService = {
    getEvents: (params) => 
        ipcRenderer.invoke('mobi-get-events', params),
    
    getUpcoming: (params) => 
        ipcRenderer.invoke('mobi-get-upcoming', params),
    
    getByType: () => 
        ipcRenderer.invoke('mobi-get-by-type'),
        
    getDateRange: (params) => 
        ipcRenderer.invoke('mobi-get-date-range', params),

    getSchedule: () => 
        ipcRenderer.invoke('mobi-get-schedule'),
    
    getLessons: (params) => 
        ipcRenderer.invoke('mobi-get-lessons', params),
    
    getDayData: (params) => 
        ipcRenderer.invoke('mobi-get-day-data', params)
};

const SystemInformationService = {
    wifi: {
        getInterfaces: () =>
            ipcRenderer.invoke('system-get-wifi-interfaces'),
        getConnections: () =>
            ipcRenderer.invoke('system-get-wifi-connections'),
        getNetworks: () =>
            ipcRenderer.invoke('system-get-wifi-networks')
    },

    hardware: {
        getCPU: () =>
            ipcRenderer.invoke('system-get-cpu-info'),
        getMemory: () =>
            ipcRenderer.invoke('system-get-memory-info'),
        getBattery: () =>
            ipcRenderer.invoke('system-get-battery-info'),
        getGraphics: () =>
            ipcRenderer.invoke('system-get-graphics-info'),
        getStorage: () =>
            ipcRenderer.invoke('system-get-storage-info')
    },

    network: {
        getInfo: () =>
            ipcRenderer.invoke('system-get-network-info'),
        getCurrentLoad: () =>
            ipcRenderer.invoke('system-get-current-load')
    },

    devices: {
        getUSB: () =>
            ipcRenderer.invoke('system-get-usb-devices'),
        getBluetooth: () =>
            ipcRenderer.invoke('system-get-bluetooth-devices'),
        getAudio: () =>
            ipcRenderer.invoke('system-get-audio-devices')
    },

    status: {
        getSystem: () =>
            ipcRenderer.invoke('system-get-system-status'),
        getProcesses: () =>
            ipcRenderer.invoke('system-get-process-info'),
        getLoad: () =>
            ipcRenderer.invoke('system-get-current-load')
    },

    repository: {
        getLatestCommit: () =>
            ipcRenderer.invoke('system-get-latest-commit'),
        getInfo: () =>
            ipcRenderer.invoke('system-get-repository-info'),
        set: (repository) =>
            ipcRenderer.invoke('system-set-repository', repository),
        get: () =>
            ipcRenderer.invoke('system-get-repository')
    },

};

const rss = {
    getNews: (category) =>
        ipcRenderer.invoke('rss-get-news', category),
    refreshNews: (category) =>
        ipcRenderer.invoke('rss-refresh-news', category),
    getAllCategories: () =>
        ipcRenderer.invoke('rss-get-all-categories'),
};

const integrations = {
    deintegrate: (integration) => ipcRenderer.invoke("deintegrate", integration),
};

contextBridge.exposeInMainWorld('backend', {
    stock: StockService,
    assistant: AssistantService,
    weather: WeatherService,
    airquality: AirQualityService,
    speech: SpeechService,
    settings,
    memos,
    mobidziennik: MobidziennikService,
    spotify: SpotifyService,
    google: CalendarService,
    systeminfo: SystemInformationService,
    system,
    rss,
    integrations,
    misc,
});


// DEBUGGER


const debuggerService = {
    config: {
        maxErrors: 100,
        maxWarnings: 50,
        maxLogs: 30,
        autoSendInterval: 30000
    },

    initialize: () => {
        try {
            ipcRenderer.on("refresh", (_, { event, data }) => {
                console.log('🔄 Refresh event received:', event, data);
                
                if (event === 'force-reload' || event === 'refresh') {
                    debuggerService.sendCurrentErrors();
                    window.location.reload(true);
                } else {
                    window.dispatchEvent(
                        new CustomEvent("refresh", {
                            detail: { event, data },
                        })
                    );
                }
            });

            ipcRenderer.on("errorlog", (_, { event, data }) => {
                console.log('📋 Error log event received:', event, data);
                
                if (event === 'get-console-errors' || event === 'collect-logs') {
                    debuggerService.sendCurrentErrors();
                } else {
                    window.dispatchEvent(
                        new CustomEvent("errorlog", {
                            detail: { event, data },
                        })
                    );
                }
            });

            // Auto-send errors periodically
            setInterval(() => {
                const state = debuggerService.getErrorState();
                if (state.hasErrors) {
                    debuggerService.sendCurrentErrors();
                }
            }, debuggerService.config.autoSendInterval);

        } catch (error) {
            console.error('❌ Error initializing debugger service:', error);
        }
    },

    sendCurrentErrors: () => {
        try {
            const errorData = {
                errors: window.capturedErrors || [],
                warnings: window.capturedWarnings || [],
                logs: window.capturedLogs || [],
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                performance: {
                    loadTime: performance.now(),
                    memory: performance.memory ? {
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
                    } : null,
                    navigation: performance.getEntriesByType('navigation')[0] || null
                }
            };

            console.log('📤 sending error data to main:', {
                errors: errorData.errors.length,
                warnings: errorData.warnings.length,
                logs: errorData.logs.length,
                timestamp: errorData.timestamp
            });

            ipcRenderer.send('console-errors-captured', errorData);
            return errorData;

        } catch (error) {
            console.error('❌ Error sending error data:', error);
            return null;
        }
    },

    initializeConsoleCapture: () => {
        try {
            window.capturedErrors = [];
            window.capturedWarnings = [];
            window.capturedLogs = [];
            
            // Store original console methods
            const originalConsole = {
                error: console.error.bind(console),
                warn: console.warn.bind(console),
                log: console.log.bind(console),
                info: console.info.bind(console)
            };

            const trimArray = (arr, maxLength) => {
                if (arr.length > maxLength) {
                    arr.splice(0, arr.length - maxLength);
                }
            };

            // Override console.error to capture errors
            console.error = function(...args) {
                try {
                    const errorEntry = {
                        type: 'error',
                        message: args.map(arg => {
                            if (typeof arg === 'object' && arg !== null) {
                                if (arg instanceof Error) {
                                    return `${arg.name}: ${arg.message}`;
                                }
                                try {
                                    return JSON.stringify(arg);
                                } catch {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        }).join(' '),
                        stack: new Error().stack,
                        timestamp: new Date().toISOString(),
                        source: 'console.error'
                    };
                    
                    window.capturedErrors.push(errorEntry);
                    trimArray(window.capturedErrors, debuggerService.config.maxErrors);
                } catch (captureError) {
                    // Fallback if capture fails
                    originalConsole.error('Failed to capture error:', captureError);
                }
                
                // Always call original console.error
                originalConsole.error.apply(console, args);
            };

            // Override console.warn
            console.warn = function(...args) {
                try {
                    const warningEntry = {
                        type: 'warning',
                        message: args.map(arg => {
                            if (typeof arg === 'object' && arg !== null) {
                                try {
                                    return JSON.stringify(arg);
                                } catch {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        }).join(' '),
                        timestamp: new Date().toISOString(),
                        source: 'console.warn'
                    };
                    
                    window.capturedWarnings.push(warningEntry);
                    trimArray(window.capturedWarnings, debuggerService.config.maxWarnings);
                } catch (captureError) {
                    originalConsole.error('Failed to capture warning:', captureError);
                }
                
                originalConsole.warn.apply(console, args);
            };

            // Override console.log
            console.log = function(...args) {
                try {
                    // Skip logging the debugger's own messages to prevent infinite loops
                    const message = args.join(' ');
                    if (message.includes('sending error data to main') || 
                        message.includes('📤') || 
                        message.includes('Debugger service')) {
                        originalConsole.log.apply(console, args);
                        return;
                    }

                    const logEntry = {
                        type: 'log',
                        message: args.map(arg => {
                            if (typeof arg === 'object' && arg !== null) {
                                try {
                                    return JSON.stringify(arg);
                                } catch {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        }).join(' '),
                        timestamp: new Date().toISOString(),
                        source: 'console.log'
                    };
                    
                    window.capturedLogs.push(logEntry);
                    trimArray(window.capturedLogs, debuggerService.config.maxLogs);
                } catch (captureError) {
                    originalConsole.error('Failed to capture log:', captureError);
                }
                
                originalConsole.log.apply(console, args);
            };

            // Capture unhandled errors
            window.addEventListener('error', (event) => {
                try {
                    window.capturedErrors.push({
                        type: 'unhandled-error',
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        stack: event.error ? event.error.stack : null,
                        timestamp: new Date().toISOString(),
                        source: 'window.error'
                    });
                    trimArray(window.capturedErrors, debuggerService.config.maxErrors);
                } catch (captureError) {
                    originalConsole.error('Failed to capture unhandled error:', captureError);
                }
            });

            // Capture unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                try {
                    window.capturedErrors.push({
                        type: 'unhandled-promise-rejection',
                        message: event.reason ? event.reason.toString() : 'Unknown promise rejection',
                        stack: event.reason && event.reason.stack ? event.reason.stack : null,
                        timestamp: new Date().toISOString(),
                        source: 'unhandledrejection'
                    });
                    trimArray(window.capturedErrors, debuggerService.config.maxErrors);
                } catch (captureError) {
                    originalConsole.error('Failed to capture promise rejection:', captureError);
                }
            });

            return true;

        } catch (error) {
            console.error('❌ Error initializing console capture:', error);
            return false;
        }
    },

    getErrorState: () => {
        return {
            hasErrors: window.capturedErrors && window.capturedErrors.length > 0,
            errorCount: window.capturedErrors ? window.capturedErrors.length : 0,
            warningCount: window.capturedWarnings ? window.capturedWarnings.length : 0,
            logCount: window.capturedLogs ? window.capturedLogs.length : 0,
            lastUpdate: new Date().toISOString()
        };
    },

    clearCapturedData: () => {
        if (window.capturedErrors) window.capturedErrors.length = 0;
        if (window.capturedWarnings) window.capturedWarnings.length = 0;
        if (window.capturedLogs) window.capturedLogs.length = 0;
    },

    getCurrentErrors: () => {
        return {
            errors: window.capturedErrors || [],
            warnings: window.capturedWarnings || [],
            logs: window.capturedLogs || [],
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            performance: {
                loadTime: performance.now(),
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
                } : null
            }
        };
    },

    testErrorCapture: () => {
        console.error('Test error message');
        console.warn('Test warning message');
        console.log('Test log message');
        
        setTimeout(() => {
            const state = debuggerService.getErrorState();
        }, 100);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    debuggerService.initialize();
    debuggerService.initializeConsoleCapture();
    
    setTimeout(() => {
        debuggerService.sendCurrentErrors();
    }, 1000);
});

window.debuggerService = debuggerService;