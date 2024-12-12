import { ipcMain } from 'electron';
import Assistant from './assistant/assistant.js';
import WeatherPlugin from './assistant/plugins/weather/index.js';
import { SpotifyClient } from './spotify/index.js';
import 'dotenv/config';
import Store from 'electron-store';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    Porcupine,
    BuiltinKeyword,
} from "@picovoice/porcupine-node";
import Record from './wakeword.js';
import { transcribeStream, synthesise } from './speech.js';
import settings from './settings/settings.js';
import memos from './memos/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const store = new Store();

let AssistantService = null;
let SpotifyService = null;

export function setup(mainWindow) {
    ipcMain.handle('misc-set-dark-theme', (event, darkTheme) => 
        store.set('misc.darkTheme', darkTheme === 1)
    );

    ipcMain.handle('misc-get-dark-theme', () => 
        store.get('misc.darkTheme'));

    // Initialise wake word detection
    // Get all files' paths from the models/wakewords folder.
    const wakeWordsDir = path.join(__dirname, `../models/wakewords/${process.platform}`);
    const keywordPaths = fs.readdirSync(wakeWordsDir, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .map(dirent => path.join(wakeWordsDir, dirent.name));

    const sensitivities = [...keywordPaths].fill(0.7);

    const porcupine = new Porcupine(
        process.env.PICOVOICE_ACCESSKEY,
        keywordPaths,
        sensitivities
    );

    const record = new Record(porcupine);
    ipcMain.handle('initialize-assistant', async (event) => {
        try {
            // Initialise OpenAI API integration
            AssistantService = new Assistant(process.env.OPENAI_API_KEY);

            // Wake word detection ("Apollo")
            const forwardEvent = (event, data) => {
                if (mainWindow?.webContents) {
                    mainWindow.webContents.send('wake-event', { event, data });
                }
            };

            // Initialize microphone before processing loop
            record.init().then(() => {
                // Mic is ready
                // Main processing loop
                const processAudio = () => {
                    const audioFrame = record.getNextAudioFrame();
                    if (audioFrame) {
                        const keywordIndex = porcupine.process(audioFrame);
                        if (keywordIndex >= 0) { // Keyword detected.
                            forwardEvent('wake'); // Forward the wake event to the preload using a previously defined function
                        }
                    }
                    setImmediate(processAudio); // Loop efficiently
                };

                processAudio(); // Start the processing loop
            }).catch((err) => {
                console.error('Failed to initialize microphone:', err);
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-message', async (event, message, conversationId, options) => {
        if (!AssistantService) {
            throw new Error('Assistant service not initialized');
        }
        return await AssistantService.sendMessage(message, conversationId, options);
    });

    ipcMain.on('stream-message', async (event, message, conversationId, options = {}) => {
        if (!AssistantService) {
            event.reply('stream-error', 'Assistant service not initialized');
            return;
        }

        try {
            await AssistantService.streamMessage(
                message,
                (chunk) => event.reply('stream-chunk', chunk),
                conversationId,
                options
            );
            event.reply('stream-end');
        } catch (error) {
            event.reply('stream-error', error.message);
        }
    });

    ipcMain.handle('clear-conversation', (event, conversationId) => {
        if (!AssistantService) {
            throw new Error('Assistant service not initialized');
        }
        AssistantService.clearConversation(conversationId);
        return { success: true };
    });

    ipcMain.handle('list-models', async () => {
        if (!AssistantService) {
            throw new Error('Assistant service not initialized');
        }
        return await AssistantService.listModels();
    });

    ipcMain.handle('get-weather', async (event, params) => {
        try {
            const weatherData = await WeatherPlugin.execute(params);
            return { success: true, data: weatherData };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    });

    ipcMain.handle('get-weather-forecast', async (event, location, units = 'celsius', days = 5) => {
        try {
            const weatherData = await WeatherPlugin.execute({
                location,
                units,
                include_forecast: true,
                forecast_days: days
            });
            return { success: true, data: weatherData };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle('get-weather-historical', async (event, location, units = 'celsius', days = 5) => {
        try {
            const weatherData = await WeatherPlugin.execute({
                location,
                units,
                include_historical: true,
                historical_days: days
            });
            return { success: true, data: weatherData };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle('get-weather-complete', async (event, params) => {
        try {
            const weatherData = await WeatherPlugin.execute({
                ...params,
                include_forecast: true,
                include_historical: true
            });
            return { success: true, data: weatherData };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle('initialize-spotify', async (event, config) => {
        const forwardEvent = (event, data) => {
            if (mainWindow?.webContents) {
                mainWindow.webContents.send('spotify-event', { event, data });
            }
        };
    
        try {
            if (SpotifyService) {
                SpotifyService.destroy();
            }

            SpotifyService = new SpotifyClient({
                ...config,
                autoSelectDevice: config?.autoSelectDevice ?? true
            });
            
            SpotifyService.on('authInitialized', (data) => {
                forwardEvent('authInitialized', data);
            });
            
            SpotifyService.on('authUrlVisited', () => {
                forwardEvent('authUrlVisited');
            });

            SpotifyService.on('authenticated', (data) => {
                forwardEvent('authenticated', data);
            });

            SpotifyService.on('tokenRefreshed', (data) => {
                forwardEvent('tokenRefreshed', data);
            });

            SpotifyService.on('ready', (data) => {
                forwardEvent('ready', data);
            });

            SpotifyService.on('deviceSelected', (data) => {
                forwardEvent('deviceSelected', data);
            });

            SpotifyService.on('warning', (warning) => {
                forwardEvent('warning', warning.message);
            });

            SpotifyService.on('error', (error) => {
                forwardEvent('error', error.message);
            });
            
            const result = await SpotifyService.initialize();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    const checkAuth = () => {
        if (!SpotifyService?.isAuthenticated) {
            throw new Error('Spotify client not authenticated');
        }
    }

    const handleSpotifyCall = async (operation) => {
        try {
            checkAuth();
            const result = await operation();
            return { success: true, ...(result && { result }) };
        } catch (error) {
            if (error.message.includes('No active device available')) {
                return { 
                    success: false, 
                    error: error.message,
                    errorType: 'NO_DEVICE',
                    devices: await SpotifyService.getDevices()
                };
            }
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle('spotify-destroy', () => {
        if (SpotifyService) {
            SpotifyService.destroy();
            SpotifyService = null;
        }
        return { success: true };
    });


    ipcMain.handle('spotify-play', async (event, options) => {
        return await handleSpotifyCall(() => SpotifyService.play(options));
    });

    ipcMain.handle('spotify-pause', async () => {
        return await handleSpotifyCall(() => SpotifyService.pause());
    });

    ipcMain.handle('spotify-next', async () => {
        return await handleSpotifyCall(() => SpotifyService.next());
    });

    ipcMain.handle('spotify-previous', async () => {
        return await handleSpotifyCall(() => SpotifyService.previous());
    });

    ipcMain.handle('spotify-seek', async (event, positionMs) => {
        return await handleSpotifyCall(() => SpotifyService.seek(positionMs));
    });

    ipcMain.handle('spotify-set-volume', async (event, volumePercent) => {
        return await handleSpotifyCall(() => SpotifyService.setVolume(volumePercent));
    });

    ipcMain.handle('spotify-set-repeat', async (event, state) => {
        return await handleSpotifyCall(() => SpotifyService.setRepeatMode(state));
    });

    ipcMain.handle('spotify-set-shuffle', async (event, state) => {
        return await handleSpotifyCall(() => SpotifyService.setShuffle(state));
    });

    ipcMain.handle('spotify-get-current-state', async () => {
        return await handleSpotifyCall(async () => {
            const state = await SpotifyService.getCurrentState();
            return { state };
        });
    });

    ipcMain.handle('spotify-get-current-track', async () => {
        return await handleSpotifyCall(async () => {
            const track = await SpotifyService.getCurrentTrack();
            return { track };
        });
    });

    ipcMain.handle('spotify-get-queue', async () => {
        return await handleSpotifyCall(async () => {
            const queue = await SpotifyService.getQueue();
            return { queue };
        });
    });

    ipcMain.handle('spotify-search', async (event, query, types, options) => {
        return await handleSpotifyCall(async () => {
            const results = await SpotifyService.search(query, types, options);
            return { results };
        });
    });

    ipcMain.handle('spotify-get-playlists', async (event, limit, offset) => {
        return await handleSpotifyCall(async () => {
            const playlists = await SpotifyService.getUserPlaylists(limit, offset);
            return { playlists };
        });
    });

    ipcMain.handle('spotify-create-playlist', async (event, userId, name, options) => {
        return await handleSpotifyCall(async () => {
            const playlist = await SpotifyService.createPlaylist(userId, name, options);
            return { playlist };
        });
    });

    ipcMain.handle('spotify-add-to-playlist', async (event, playlistId, uris, options) => {
        return await handleSpotifyCall(async () => {
            const result = await SpotifyService.addTracksToPlaylist(playlistId, uris, options);
            return { result };
        });
    });

    ipcMain.handle('spotify-get-devices', async () => {
        return await handleSpotifyCall(async () => {
            const devices = await SpotifyService.getDevices();
            return { devices };
        });
    });

    ipcMain.handle('spotify-set-device', async (event, deviceId) => {
        return await handleSpotifyCall(async () => {
            await SpotifyService.setDevice(deviceId);
            return { deviceId };
        });
    });

    ipcMain.handle('spotify-add-to-queue', async (event, uri) => {
        return await handleSpotifyCall(() => SpotifyService.addToQueue(uri));
    });

    ipcMain.handle('speech-transcribe-stream', async (event) => {
        const forwardEvent = (event, data) => {
            if (mainWindow?.webContents) {
                mainWindow.webContents.send('speech-event', { event, data });
            }
        };

        record.pause();
        transcribeStream(
            (transcript) => forwardEvent('chunk', transcript),
            (transcript) => {
                forwardEvent('finished', transcript);
                record.unpause();
            } ,
        );
    });

    ipcMain.handle('speech-synthesise', async (event, text) => {
        const voice = store.get('settings.speech.voice', 'alloy');
        synthesise(text, voice);
    });

    ipcMain.handle('setting-set', async (event, key, value) => 
        settings.set(key, value));

    ipcMain.handle('setting-get', async (event, key) =>
        settings.get(key));

    ipcMain.handle('memo-create', async (event, title, value) =>
        memos.createNote(title, value));

    ipcMain.handle('memo-title-set', async (event, noteIndex, value) =>
        memos.setNoteTitle(noteIndex, value));

    ipcMain.handle('memo-content-set', async (event, noteIndex, value) =>
        memos.setNoteContent(noteIndex, value));

    ipcMain.handle('memos-get', async (event) =>
        memos.getNotes());
}