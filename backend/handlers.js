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
import { SystemInfoManager } from "./os/information.js";
import { deintegrate } from "./link/link.js";
import Main from "electron/main";
import { emulateInvoke } from "./assistant/helpers.js";
import { setBrightness } from "./display-brightness/index.js";
import StockService from './stock/index.js';


let latestErrorData = {
    errors: [],
    warnings: [],
    logs: [],
    url: '',
    userAgent: '',
    timestamp: null,
    performance: null
};


process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION - Main Process:', error);
    console.error('Stack:', error.stack);
    // Don't exit immediately, log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION - Main Process:', reason);
    console.error('Promise:', promise);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const store = new Store();

let AssistantService = null;
let SpotifyService = null;
let CalendarService = null;
let SystemInfoService = null;
let stockService = null;


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

    function initializeStockService() {
        if (!stockService) {
            stockService = new StockService({
                cacheDuration: 5 * 60 * 1000, // 5 minutes
                quoteCacheDuration: 1 * 60 * 1000, // 1 minute for live quotes
                historicalCacheDuration: 30 * 60 * 1000, // 30 minutes for historical
            });

            stockService.on('error', (error) => {
                console.error('Stock service error:', error);
            });

            stockService.on('cacheHit', (data) => {
                console.log('Stock cache hit:', data.key);
            });
        }
        return stockService;
    }

    // STOCK

    ipcMain.handle("stock-get-quote", async (event, symbol) => {
        try {
            const service = initializeStockService();
            const result = await service.getQuote(symbol);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get stock quote error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-quotes", async (event, symbols) => {
        try {
            const service = initializeStockService();
            const result = await service.getQuotes(symbols);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get stock quotes error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-historical", async (event, symbol, options = {}) => {
        try {
            const service = initializeStockService();
            const result = await service.getHistoricalData(symbol, options);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get stock historical data error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-search", async (event, query, options = {}) => {
        try {
            const service = initializeStockService();
            const result = await service.search(query, options);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Stock search error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-market-summary", async () => {
        try {
            const service = initializeStockService();
            const result = await service.getMarketSummary();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get market summary error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Watchlist handlers
    ipcMain.handle("stock-add-to-watchlist", async (event, symbol) => {
        try {
            const service = initializeStockService();
            service.addToWatchlist(symbol);
            return {
                success: true,
                data: { watchlist: service.getWatchlist() },
            };
        } catch (error) {
            console.error("Add to watchlist error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-remove-from-watchlist", async (event, symbol) => {
        try {
            const service = initializeStockService();
            service.removeFromWatchlist(symbol);
            return {
                success: true,
                data: { watchlist: service.getWatchlist() },
            };
        } catch (error) {
            console.error("Remove from watchlist error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-watchlist", async () => {
        try {
            const service = initializeStockService();
            const watchlist = service.getWatchlist();
            return {
                success: true,
                data: { watchlist },
            };
        } catch (error) {
            console.error("Get watchlist error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-watchlist-quotes", async () => {
        try {
            const service = initializeStockService();
            const result = await service.getWatchlistQuotes();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get watchlist quotes error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Portfolio handlers
    ipcMain.handle("stock-create-portfolio", async (event, name, description = '') => {
        try {
            const service = initializeStockService();
            const portfolioId = service.createPortfolio(name, description);
            return {
                success: true,
                data: { portfolioId },
            };
        } catch (error) {
            console.error("Create portfolio error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-add-to-portfolio", async (event, portfolioId, symbol, shares, purchasePrice, purchaseDate) => {
        try {
            const service = initializeStockService();
            service.addToPortfolio(portfolioId, symbol, shares, purchasePrice, purchaseDate);
            return {
                success: true,
                data: { message: 'Holding added successfully' },
            };
        } catch (error) {
            console.error("Add to portfolio error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-portfolio-value", async (event, portfolioId) => {
        try {
            const service = initializeStockService();
            const result = await service.getPortfolioValue(portfolioId);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get portfolio value error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-portfolios", async () => {
        try {
            const service = initializeStockService();
            const portfolios = service.getPortfolios();
            return {
                success: true,
                data: { portfolios },
            };
        } catch (error) {
            console.error("Get portfolios error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Utility handlers
    ipcMain.handle("stock-is-market-open", async (event, exchange = 'NYSE') => {
        try {
            const service = initializeStockService();
            const result = await service.isMarketOpen(exchange);
            return {
                success: true,
                data: { isOpen: result },
            };
        } catch (error) {
            console.error("Check market status error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-clear-cache", async () => {
        try {
            const service = initializeStockService();
            service.clearCache();
            return {
                success: true,
                data: { message: 'Cache cleared successfully' },
            };
        } catch (error) {
            console.error("Clear cache error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-get-cache-stats", async () => {
        try {
            const service = initializeStockService();
            const stats = service.getCacheStats();
            return {
                success: true,
                data: stats,
            };
        } catch (error) {
            console.error("Get cache stats error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("stock-bulk-quotes", async (event, symbols, batchSize = 10) => {
        try {
            const service = initializeStockService();
            const result = await service.getBulkQuotes(symbols, batchSize);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Bulk quotes error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    //DEBUGGER

    ipcMain.on("console-errors-captured", (event, errorData) => {
        // Store the latest error data
        latestErrorData = {
            ...errorData,
            receivedAt: new Date().toISOString(),
        };

        if (global.debugServer && global.debugServer.getStatus().isRunning) {
            global.debugServer.lastErrorCapture = errorData;
        }

        if (errorData.errors.length > 0) {
            console.log("📋 Recent errors:", errorData.errors.slice(-3));
        }
    });

    ipcMain.handle("refresh", () => {
        mainWindow.webContents.send("refresh", {
            event: "force-reload",
            data: {
                triggeredBy: "main-process",
                timestamp: new Date().toISOString(),
            },
        });
        return { success: true };
    });

    // Updated to just return cached error data immediately
    ipcMain.handle("request-error-logs", () => {
        return {
            success: true,
            data: latestErrorData,
            timestamp: new Date().toISOString(),
            cached: true,
        };
    });

    const refreshPage = () => {
        mainWindow.webContents.send("refresh", {
            event: "force-reload",
            data: {
                method: "direct-call",
                timestamp: new Date().toISOString(),
            },
        });
    };

    const collectLogs = () => {
        mainWindow.webContents.send("errorlog", {
            event: "collect-logs",
            data: {
                method: "direct-call",
                timestamp: new Date().toISOString(),
            },
        });
    };

    const getErrorLogs = () => {
        return {
            success: true,
            data: latestErrorData,
            timestamp: new Date().toISOString(),
        };
    };

    global.debugHelpers = {
        refreshPage,
        collectLogs,
        getErrorLogs,
        getWindow: () => mainWindow,
        getLatestErrors: () => latestErrorData,
    };

    // INFORMATION HANDLERS

    SystemInfoService = new SystemInfoManager();

    ipcMain.handle("system-get-wifi-interfaces", async () => {
        try {
            const result = await SystemInfoService.getWiFiInterfaces();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get WiFi interfaces error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-wifi-connections", async () => {
        try {
            const result = await SystemInfoService.getWiFiConnections();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get WiFi connections error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-wifi-networks", async () => {
        try {
            const result = await SystemInfoService.getWiFiNetworks();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get WiFi networks error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Hardware Information
    ipcMain.handle("system-get-cpu-info", async () => {
        try {
            const result = await SystemInfoService.getCPUInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get CPU info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-memory-info", async () => {
        try {
            const result = await SystemInfoService.getMemoryInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get memory info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-battery-info", async () => {
        try {
            const result = await SystemInfoService.getBatteryInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get battery info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-network-info", async () => {
        try {
            const result = await SystemInfoService.getNetworkInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get network info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-graphics-info", async () => {
        try {
            const result = await SystemInfoService.getGraphicsInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get graphics info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-storage-info", async () => {
        try {
            const result = await SystemInfoService.getStorageInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get storage info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Device Information
    ipcMain.handle("system-get-usb-devices", async () => {
        try {
            const result = await SystemInfoService.getUSBDevices();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get USB devices error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-bluetooth-devices", async () => {
        try {
            const result = await SystemInfoService.getBluetoothDevices();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get Bluetooth devices error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-audio-devices", async () => {
        try {
            const result = await SystemInfoService.getAudioDevices();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get audio devices error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // System Status and Performance
    ipcMain.handle("system-get-current-load", async () => {
        try {
            const result = await SystemInfoService.getCurrentLoad();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get current load error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-system-status", async () => {
        try {
            const result = await SystemInfoService.getSystemStatus();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get system status error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-process-info", async () => {
        try {
            const result = await SystemInfoService.getProcessInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get process info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Repository Information
    ipcMain.handle("system-get-latest-commit", async () => {
        try {
            const result = await SystemInfoService.getLatestCommitInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get latest commit error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-repository-info", async () => {
        try {
            const result = await SystemInfoService.getRepositoryInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get repository info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Comprehensive System Report
    ipcMain.handle("system-get-comprehensive-info", async () => {
        try {
            const result = await SystemInfoService.getComprehensiveSystemInfo();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Get comprehensive system info error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Repository Management
    ipcMain.handle("system-set-repository", async (event, repository) => {
        try {
            SystemInfoService.setRepository(repository);
            return {
                success: true,
                data: { repository: SystemInfoService.getRepository() },
            };
        } catch (error) {
            console.error("Set repository error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("system-get-repository", async () => {
        try {
            const result = SystemInfoService.getRepository();
            return {
                success: true,
                data: { repository: result },
            };
        } catch (error) {
            console.error("Get repository error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Mobidziennik events

    ipcMain.handle("mobi-get-events", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.execute(params);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get events error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("mobi-get-upcoming", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getUpcoming(params);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get upcoming error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("mobi-get-by-type", async () => {
        try {
            const result = await MobidziennikService.getByType();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get by type error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("mobi-get-date-range", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getDateRange(params);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get date range error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // New lesson schedule handlers

    ipcMain.handle("mobi-get-schedule", async () => {
        try {
            const result = await MobidziennikService.getSchedule();
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get schedule error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("mobi-get-lessons", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getLessons(params);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get lessons error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("mobi-get-day-data", async (event, params = {}) => {
        try {
            const result = await MobidziennikService.getDayData(params);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            console.error("Mobidziennik get day data error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // RSS
    const rssManager = new RSSManager();

    ipcMain.handle("rss-get-news", async (event, category = "tech") => {
        try {
            const news = await rssManager.getNews(category);
            return {
                success: true,
                news: news,
            };
        } catch (error) {
            console.error("RSS get news error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("rss-refresh-news", async (event, category = "tech") => {
        try {
            const news = await rssManager.refreshNews(category);
            return {
                success: true,
                news: news,
            };
        } catch (error) {
            console.error("RSS refresh news error:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("rss-get-all-categories", async () => {
        try {
            const allNews = await rssManager.getAllCategories();
            return {
                success: true,
                news: allNews,
            };
        } catch (error) {
            console.error("RSS get all categories error:", error);
            return {
                success: false,
                error: error.message,
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
    // ipcMain.handle("misc-set-dark-theme", (event, darkTheme) =>
    //     store.set("misc.darkTheme", darkTheme === 1)
    // );

    // ipcMain.handle("misc-get-dark-theme", () => store.get("misc.darkTheme"));

    let lowPowerActive = false;

    const setLowPower = async (enabled) => {
        if (lowPowerActive === enabled) return;

        if (enabled) {
            setBrightness(20, 300);
            mainWindow.loadFile("./static/low-power.html");
        } else {
            setBrightness(100, 300);
            mainWindow.loadFile("./static/index.html");
        }

        lowPowerActive = enabled;
    };

    ipcMain.handle("misc-set-low-power-mode", (event, enabled) => {
        setLowPower(enabled);
    });

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

            wake.removeAllListeners();
            wake.on("wake", () => {
                if (lowPowerActive) {
                    setLowPower(false);
                    setTimeout(() => {
                        forwardEvent("wake");
                    }, 3000);
                } else {
                    forwardEvent("wake");
                }
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

    // Air Quality / Weather integration

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

    ipcMain.handle("get-air-quality", async (event, params) => {
        try {
            const airQualityData = await WeatherPlugin.getAirQuality(params);
            return { success: true, data: airQualityData };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle(
        "get-air-quality-forecast",
        async (event, location, days = 4) => {
            try {
                const airQualityData = await WeatherPlugin.getAirQuality({
                    location,
                    include_forecast: true,
                    forecast_days: days,
                });
                return { success: true, data: airQualityData };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }
        }
    );

    ipcMain.handle(
        "get-air-quality-historical",
        async (event, location, days = 5) => {
            try {
                const airQualityData = await WeatherPlugin.getAirQuality({
                    location,
                    include_historical: true,
                    historical_days: days,
                });
                return { success: true, data: airQualityData };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }
        }
    );

    ipcMain.handle("get-air-quality-complete", async (event, params) => {
        try {
            const airQualityData = await WeatherPlugin.getAirQuality({
                location: params,
                include_forecast: true,
                include_historical: true,
            });
            return { success: true, data: airQualityData };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Spotify integration

    ipcMain.handle("initialize-spotify", async (event, config) => {
        const forwardEvent = (eventName, data) => {
            // Safely send events to renderer
            try {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("spotify-event", {
                        event: eventName,
                        data,
                    });
                }
            } catch (error) {
                console.error("Error forwarding spotify event:", error);
            }
        };

        try {
            if (!SpotifyService) {
                SpotifyService = new SpotifyClient({
                    ...config,
                    autoSelectDevice: config?.autoSelectDevice ?? true,
                });

                // Setup event forwarding
                SpotifyService.on("authInitialized", (data) =>
                    forwardEvent("authInitialized", data)
                );
                SpotifyService.on("authUrlVisited", () =>
                    forwardEvent("authUrlVisited")
                );
                SpotifyService.on("authenticated", (data) =>
                    forwardEvent("authenticated", data)
                );
                SpotifyService.on("tokenRefreshed", (data) =>
                    forwardEvent("tokenRefreshed", data)
                );
                SpotifyService.on("ready", (data) =>
                    forwardEvent("ready", data)
                );
                SpotifyService.on("deviceSelected", (data) =>
                    forwardEvent("deviceSelected", data)
                );
                SpotifyService.on("warning", (warning) =>
                    forwardEvent("warning", warning.message)
                );
                SpotifyService.on("error", (error) =>
                    forwardEvent("error", error.message)
                );
            }

            // Always initialize, even if we already have the service
            const result = await SpotifyService.initialize();
            return { success: true, ...result };
        } catch (error) {
            console.error("Spotify initialization error:", error);
            forwardEvent("error", error.message);
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
            // Only remove the internal service resources, not the service itself
            SpotifyService.destroy();

            // But keep the SpotifyService instance and its event listeners
            // Don't set SpotifyService = null

            return { success: true };
        }
        return { success: false, error: "No active spotify service" };
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
        const forwardEvent = (eventName, data) => {
            // Safely send events to renderer
            try {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("calendar-event", {
                        event: eventName,
                        data,
                    });
                }
            } catch (error) {
                console.error("Error forwarding calendar event:", error);
            }
        };

        try {
            if (!CalendarService) {
                CalendarService = new GoogleCalendarClient(config);

                // Setup event forwarding
                CalendarService.on("authInitialized", (data) =>
                    forwardEvent("authInitialized", data)
                );
                CalendarService.on("authUrlVisited", (data) =>
                    forwardEvent("authUrlVisited", data)
                );
                CalendarService.on("authenticated", (data) =>
                    forwardEvent("authenticated", data)
                );
                CalendarService.on("ready", (data) =>
                    forwardEvent("ready", data)
                );
                CalendarService.on("error", (error) =>
                    forwardEvent("error", { message: error.message })
                );
                CalendarService.on("tokenRefreshed", (data) =>
                    forwardEvent("tokenRefreshed", data)
                );
            }

            // Always initialize, even if we already have the service
            const result = await CalendarService.initialize();
            return result;
        } catch (error) {
            console.error("Calendar initialization error:", error);
            forwardEvent("error", { message: error.message });
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
            // Only remove the internal service resources, not the service itself
            CalendarService.destroy();

            // But keep the CalendarService instance and its event listeners
            // Don't set CalendarService = null

            return { success: true };
        }
        return { success: false, error: "No active calendar service" };
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
        const calendars = await handleCalendarCall(() =>
            CalendarService.getCalendarList()
        );

        const now = new Date().toISOString();

        const allEvents = await Promise.all(
            calendars.result.map(async (cal) => {
                const events = await handleCalendarCall(() =>
                    CalendarService.getEvents(cal.id, {
                        timeMin: now,
                        maxResults: 50, // adjust as needed
                    })
                );
                return events.result.map((event) => ({
                    ...event,
                    calendarId: cal.id,
                }));
            })
        );

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

    // App Stuff™
    ipcMain.handle("appstuff-set", async (event, key, value) => store.set("appstuff." + key, value));
    ipcMain.handle("appstuff-get", async (event, key) => store.get("appstuff." + key));

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

    ipcMain.handle("deintegrate", async (event, integration) => {
        deintegrate(integration);

        let integrationObject;
        let initializationFunction;
        switch (integration) {
            case "spotify":
                integrationObject = SpotifyService;
                initializationFunction = () => {
                    try {
                        SpotifyService.initialize();
                    } catch (err) {
                        console.warn("Error re-initializing Spotify:", err);
                    }
                };
                break;

            case "google":
                integrationObject = CalendarService;
                initializationFunction = () => {
                    try {
                        CalendarService.initialize();
                    } catch (err) {
                        console.warn("Error re-initializing Calendar:", err);
                    }
                };
                break;

            default:
                break;
        }

        if (!integrationObject)
            return { success: false, message: "Integration not found" };

        try {
            integrationObject.destroy();
            initializationFunction();
            return { success: true };
        } catch (err) {
            console.warn("Error during deintegration:", err);
            return { success: false, error: err.message };
        }
    });
}
