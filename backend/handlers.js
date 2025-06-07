import { ipcMain, session } from "electron";
import Assistant from "./assistant/assistant.js";
import WeatherPlugin from "./assistant/plugins/weather/index.js";
import "dotenv/config";
import Store from "electron-store";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WakeWord from "./wake.js";
import { transcribeStream, synthesise } from "./speech.js";
import settings from "./settings/settings.js";
import memos from "./memos/index.js";
import { RSSManager } from './rss/index.js';
import MobidziennikService from './assistant/plugins/mobidziennik/events.js';



import { SpotifyClient } from "./spotify/index.js";
import GoogleCalendarClient from "./google-calendar/index.js";

import { WiFiManager } from "./os/wifi.js";
import { deintegrate } from "./link/link.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const store = new Store();

let AssistantService = null;
let SpotifyService = null;
let CalendarService = null;

export function setup(mainWindow) {
    session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback) => {
            if (permission === "media") {
                // you can add logic to check the origin here
                callback(true); // ✅ allow mic/camera access
            } else {
                callback(false);
            }
        }
    );

    // Mobidziennik events

    ipcMain.handle("mobi-get-events", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.execute(params);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Mobidziennik get events error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("mobi-get-upcoming", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getUpcoming(params);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Mobidziennik get upcoming error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("mobi-get-by-type", async () => {
        try {
            const result = await MobidziennikService.getByType();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Mobidziennik get by type error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("mobi-get-date-range", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getDateRange(params);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Mobidziennik get date range error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // RSS
    const rssManager = new RSSManager();

    ipcMain.handle("rss-get-news", async (event, category = 'tech') => {
        try {
            const news = await rssManager.getNews(category);
            return {
                success: true,
                news: news
            };
        } catch (error) {
            console.error('RSS get news error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("rss-refresh-news", async (event, category = 'tech') => {
        try {
            const news = await rssManager.refreshNews(category);
            return {
                success: true,
                news: news
            };
        } catch (error) {
            console.error('RSS refresh news error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle("rss-get-all-categories", async () => {
        try {
            const allNews = await rssManager.getAllCategories();
            return {
                success: true,
                news: allNews
            };
        } catch (error) {
            console.error('RSS get all categories error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });


    // OS
    const wifiManager = new WiFiManager();
    ipcMain.handle("wifi-list-networks", async () => {
        try {
            return await wifiManager.listNetworks();
        } catch (error) {
            throw new Error("Failed to list networks: " + error.message);
        }
    });

    ipcMain.handle("wifi-connect", async (event, ssid, password) => {
        try {
            const result = await wifiManager.connect(ssid, password);

            return result;
        } catch (error) {
            throw new Error("Failed to connect to network: " + error.message);
        }
    });

    ipcMain.handle("wifi-status", async () => {
        try {
            const status = await wifiManager.status();
            return status;
        } catch (error) {
            throw new Error("Failed to get WiFi status: " + error.message);
        }
    });

    // Misc
    ipcMain.handle("misc-set-dark-theme", (event, darkTheme) =>
        store.set("misc.darkTheme", darkTheme === 1)
    );

    ipcMain.handle("misc-get-dark-theme", () => store.get("misc.darkTheme"));

    // Assistant (AI + wake word) integration

    const wake = new WakeWord();
    ipcMain.handle("initialize-assistant", async (event) => {
        try {
            // Initialise OpenAI API integration
            AssistantService = new Assistant(process.env.OPENAI_API_KEY);
            AssistantService.createRealtimeSession();

            // Wake word detection ("Apollo")
            const forwardEvent = (event, data) => {
                if (mainWindow?.webContents) {
                    mainWindow.webContents.send("wake-event", { event, data });
                }
            };

            wake.start();
            // Initialize microphone before processing loop
            wake.on("wake", () => {
                forwardEvent("wake");
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(
        "send-message",
        async (event, message, conversationId, options) => {
            if (!AssistantService) {
                throw new Error("Assistant service not initialized");
            }
            return await AssistantService.sendMessage(
                message,
                conversationId,
                options
            );
        }
    );

    ipcMain.on(
        "stream-message",
        async (event, message, conversationId, options = {}) => {
            if (!AssistantService) {
                event.reply(
                    "stream-error",
                    "Assistant service not initialized"
                );
                return;
            }

            try {
                await AssistantService.streamMessage(
                    message,
                    (chunk) => event.reply("stream-chunk", chunk),
                    conversationId,
                    options
                );
                event.reply("stream-end");
            } catch (error) {
                event.reply("stream-error", error.message);
            }
        }
    );

    ipcMain.handle("clear-conversation", (event, conversationId) => {
        if (!AssistantService) {
            throw new Error("Assistant service not initialized");
        }
        AssistantService.clearConversation(conversationId);
        return { success: true };
    });

    ipcMain.handle("list-models", async () => {
        if (!AssistantService) {
            throw new Error("Assistant service not initialized");
        }
        return await AssistantService.listModels();
    });

    ipcMain.handle("create-realtime-session", async () => {
        if (!AssistantService) {
            throw new Error("Assistant service not initialized");
        }
        return await AssistantService.createRealtimeSession();
    });

    // Weather integration

    ipcMain.handle("get-weather", async (event, params) => {
        try {
            const weatherData = await WeatherPlugin.execute(params);
            return { success: true, data: weatherData };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle(
        "get-weather-forecast",
        async (event, location, units = "celsius", days = 5) => {
            try {
                const weatherData = await WeatherPlugin.execute({
                    location,
                    units,
                    include_forecast: true,
                    forecast_days: days,
                });
                return { success: true, data: weatherData };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }
        }
    );

    ipcMain.handle(
        "get-weather-historical",
        async (event, location, units = "celsius", days = 5) => {
            try {
                const weatherData = await WeatherPlugin.execute({
                    location,
                    units,
                    include_historical: true,
                    historical_days: days,
                });
                return { success: true, data: weatherData };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }
        }
    );

    ipcMain.handle("get-weather-complete", async (event, params) => {
        try {
            const weatherData = await WeatherPlugin.execute({
                ...params,
                include_forecast: true,
                include_historical: true,
            });
            return { success: true, data: weatherData };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Spotify integration

    ipcMain.handle("initialize-spotify", async (event, config) => {
        const forwardEvent = (event, data) => {
            if (mainWindow?.webContents) {
                mainWindow.webContents.send("spotify-event", { event, data });
            }
        };

        try {
            if (SpotifyService) {
                SpotifyService.destroy();
            }

            SpotifyService = new SpotifyClient({
                ...config,
                autoSelectDevice: config?.autoSelectDevice ?? true,
            });

            SpotifyService.on("authInitialized", (data) => {
                forwardEvent("authInitialized", data);
            });

            SpotifyService.on("authUrlVisited", () => {
                forwardEvent("authUrlVisited");
            });

            SpotifyService.on("authenticated", (data) => {
                forwardEvent("authenticated", data);
            });

            SpotifyService.on("tokenRefreshed", (data) => {
                forwardEvent("tokenRefreshed", data);
            });

            SpotifyService.on("ready", (data) => {
                forwardEvent("ready", data);
            });

            SpotifyService.on("deviceSelected", (data) => {
                forwardEvent("deviceSelected", data);
            });

            SpotifyService.on("warning", (warning) => {
                forwardEvent("warning", warning.message);
            });

            SpotifyService.on("error", (error) => {
                forwardEvent("error", error.message);
            });

            const result = await SpotifyService.initialize();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    const checkAuth = () => {
        if (!SpotifyService?.isAuthenticated) {
            throw new Error("Spotify client not authenticated");
        }
    };

    const handleSpotifyCall = async (operation) => {
        try {
            checkAuth();
            const result = await operation();
            return { success: true, ...(result && { result }) };
        } catch (error) {
            if (error.message.includes("No active device available")) {
                return {
                    success: false,
                    error: error.message,
                    errorType: "NO_DEVICE",
                    devices: await SpotifyService.getDevices(),
                };
            }
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle("spotify-destroy", () => {
        if (SpotifyService) {
            SpotifyService.destroy();
            SpotifyService = null;
        }
        return { success: true };
    });

    ipcMain.handle("spotify-play", async (event, options) => {
        return await handleSpotifyCall(() => SpotifyService.play(options));
    });

    ipcMain.handle("spotify-pause", async () => {
        return await handleSpotifyCall(() => SpotifyService.pause());
    });

    ipcMain.handle("spotify-next", async () => {
        return await handleSpotifyCall(() => SpotifyService.next());
    });

    ipcMain.handle("spotify-previous", async () => {
        return await handleSpotifyCall(() => SpotifyService.previous());
    });

    ipcMain.handle("spotify-seek", async (event, positionMs) => {
        return await handleSpotifyCall(() => SpotifyService.seek(positionMs));
    });

    ipcMain.handle("spotify-set-volume", async (event, volumePercent) => {
        return await handleSpotifyCall(() =>
            SpotifyService.setVolume(volumePercent)
        );
    });

    ipcMain.handle("spotify-set-repeat", async (event, state) => {
        return await handleSpotifyCall(() =>
            SpotifyService.setRepeatMode(state)
        );
    });

    ipcMain.handle("spotify-set-shuffle", async (event, state) => {
        return await handleSpotifyCall(() => SpotifyService.setShuffle(state));
    });

    ipcMain.handle("spotify-get-current-state", async () => {
        return await handleSpotifyCall(async () => {
            const state = await SpotifyService.getCurrentState();
            return { state };
        });
    });

    ipcMain.handle("spotify-get-current-track", async () => {
        return await handleSpotifyCall(async () => {
            const track = await SpotifyService.getCurrentTrack();
            return { track };
        });
    });

    ipcMain.handle("spotify-get-queue", async () => {
        return await handleSpotifyCall(async () => {
            const queue = await SpotifyService.getQueue();
            return { queue };
        });
    });

    ipcMain.handle("spotify-search", async (event, query, types, options) => {
        return await handleSpotifyCall(async () => {
            const results = await SpotifyService.search(query, types, options);
            return { results };
        });
    });

    ipcMain.handle("spotify-get-playlists", async (event, limit, offset) => {
        return await handleSpotifyCall(async () => {
            const playlists = await SpotifyService.getUserPlaylists(
                limit,
                offset
            );
            return { playlists };
        });
    });

    ipcMain.handle(
        "spotify-create-playlist",
        async (event, userId, name, options) => {
            return await handleSpotifyCall(async () => {
                const playlist = await SpotifyService.createPlaylist(
                    userId,
                    name,
                    options
                );
                return { playlist };
            });
        }
    );

    ipcMain.handle(
        "spotify-add-to-playlist",
        async (event, playlistId, uris, options) => {
            return await handleSpotifyCall(async () => {
                const result = await SpotifyService.addTracksToPlaylist(
                    playlistId,
                    uris,
                    options
                );
                return { result };
            });
        }
    );

    ipcMain.handle("spotify-get-devices", async () => {
        return await handleSpotifyCall(async () => {
            const devices = await SpotifyService.getDevices();
            return { devices };
        });
    });

    ipcMain.handle("spotify-set-device", async (event, deviceId) => {
        return await handleSpotifyCall(async () => {
            await SpotifyService.setDevice(deviceId);
            return { deviceId };
        });
    });

    ipcMain.handle("spotify-add-to-queue", async (event, uri) => {
        return await handleSpotifyCall(() => SpotifyService.addToQueue(uri));
    });

    // Google Calendar integration

    ipcMain.handle("initialize-calendar", async (event, config) => {
        const forwardEvent = (event, data) => {
            if (mainWindow?.webContents) {
                mainWindow.webContents.send("calendar-event", { event, data });
            }
        };

        try {
            if (CalendarService) {
                CalendarService.destroy();
            }

            CalendarService = new GoogleCalendarClient(config);

            CalendarService.on("authInitialized", (data) => {
                forwardEvent("authInitialized", data);
            });

            CalendarService.on("authUrlVisited", () => {
                forwardEvent("authUrlVisited");
            });

            CalendarService.on("authenticated", (data) => {
                forwardEvent("authenticated", data);
            });

            CalendarService.on("tokenRefreshed", (data) => {
                forwardEvent("tokenRefreshed", data);
            });

            CalendarService.on("ready", (data) => {
                forwardEvent("ready", data);
            });

            CalendarService.on("error", (error) => {
                forwardEvent("error", error.message);
            });

            const result = await CalendarService.initialize();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    const handleCalendarCall = async (operation) => {
        try {
            // Check auth status
            if (!CalendarService?.isAuthenticated) {
                throw new Error("Calendar client not authenticated");
            }

            const result = await operation();
            return { success: true, ...(result && { result }) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle("calendar-destroy", () => {
        if (CalendarService) {
            CalendarService.destroy();
            CalendarService = null;
        }
        return { success: true };
    });

    ipcMain.handle(
        "calendar-get-events",
        async (event, calendarId, options) => {
            return await handleCalendarCall(() =>
                CalendarService.getEvents(calendarId, options)
            );
        }
    );

    ipcMain.handle(
        "calendar-create-event",
        async (event, calendarId, eventData) => {
            return await handleCalendarCall(() =>
                CalendarService.createEvent(calendarId, eventData)
            );
        }
    );

    ipcMain.handle(
        "calendar-update-event",
        async (event, calendarId, eventId, eventData) => {
            return await handleCalendarCall(() =>
                CalendarService.updateEvent(calendarId, eventId, eventData)
            );
        }
    );

    ipcMain.handle(
        "calendar-delete-event",
        async (event, calendarId, eventId) => {
            return await handleCalendarCall(() =>
                CalendarService.deleteEvent(calendarId, eventId)
            );
        }
    );

    ipcMain.handle("calendar-get-calendars", async () => {
        return await handleCalendarCall(() =>
            CalendarService.getCalendarList()
        );
    });

    ipcMain.handle("calendar-get-calendar", async (event, calendarId) => {
        return await handleCalendarCall(() =>
            CalendarService.getCalendarById(calendarId)
        );
    });

    ipcMain.handle("calendar-create-calendar", async (event, calendarData) => {
        return await handleCalendarCall(() =>
            CalendarService.createCalendar(calendarData)
        );
    });

    ipcMain.handle(
        "calendar-update-calendar",
        async (event, calendarId, calendarData) => {
            return await handleCalendarCall(() =>
                CalendarService.updateCalendar(calendarId, calendarData)
            );
        }
    );

    ipcMain.handle("calendar-delete-calendar", async (event, calendarId) => {
        return await handleCalendarCall(() =>
            CalendarService.deleteCalendar(calendarId)
        );
    });

    ipcMain.handle("calendar-get-upcoming-events", async (event) => {
        const calendars = await handleCalendarCall(() => CalendarService.getCalendarList());

        const now = new Date().toISOString();

        const allEvents = await Promise.all(
            calendars.result.map(async (cal) => {
                const events = await handleCalendarCall(() => CalendarService.getEvents(cal.id, {
                    timeMin: now,
                    maxResults: 50, // adjust as needed
                }));
                return events.result.map((event) => ({
                    ...event,
                    calendarId: cal.id,
                }));
            })
        );

        console.log(allEvents);

        // Flatten and sort all events by start time
        const upcomingEvents = allEvents.flat().sort((a, b) => {
            const aStart = new Date(
                a.start?.dateTime || a.start?.date
            ).getTime();
            const bStart = new Date(
                b.start?.dateTime || b.start?.date
            ).getTime();
            return aStart - bStart;
        });

        return await handleCalendarCall(() => CalendarService.getEvents());
    });

    // (async () => {
    //     console.log(
    //         await handleCalendarCall(() => CalendarService.getCalendarList())
    //     );
    // })();

    // STT/TTS integration
    ipcMain.handle("speech-transcribe-stream", async (event) => {
        const forwardEvent = (event, data) => {
            if (mainWindow?.webContents) {
                mainWindow.webContents.send("speech-event", { event, data });
            }
        };

        wake.paused = true;
        transcribeStream(
            (transcript) => forwardEvent("chunk", transcript),
            (transcript) => {
                forwardEvent("finished", transcript);
                wake.paused = false;
            }
        );
    });

    ipcMain.handle("speech-synthesise", async (event, text) => {
        const voice = store.get("settings.speech.voice", "alloy");
        synthesise(text, voice);
    });

    // Settings handling
    ipcMain.handle("setting-set", async (event, key, value) =>
        settings.set(key, value)
    );

    ipcMain.handle("setting-get", async (event, key) => settings.get(key));

    // Memos integration
    ipcMain.handle("memo-create", async (event, title, value) =>
        memos.createNote(title, value)
    );

    ipcMain.handle("memo-title-set", async (event, noteIndex, value) =>
        memos.setNoteTitle(noteIndex, value)
    );

    ipcMain.handle("memo-content-set", async (event, noteIndex, value) =>
        memos.setNoteContent(noteIndex, value)
    );

    ipcMain.handle("memos-get", async (event) => memos.getNotes());

    ipcMain.handle("deintegrate", async (event, integration) => deintegrate(integration))
}
