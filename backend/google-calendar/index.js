import { google } from "googleapis";
import EventEmitter from "events";
import QRCode from "qrcode";
import axios from "axios";
import { EventSource } from "eventsource";
import { getIntegrations, setIntegration } from "../link/link.js";

export default class GoogleCalendarClient extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            authServerUrl:
                config.authServerUrl || `${process.env.API_BASE_URL}/google`,
            autoRefresh: config.autoRefresh !== false,
            refreshThreshold: config.refreshThreshold || 300,
            tokenRefreshPadding: config.tokenRefreshPadding || 60,
            scopes: config.scopes || [
                "https://www.googleapis.com/auth/calendar",
            ],
        };

        const integration = getIntegrations().google;
        this.accessToken = integration?.accessToken;
        this.refreshToken = integration?.refreshToken;
        this.expiresAt = integration?.expiresAt;
        console.log(integration);

        this.calendar = null;
        this.auth = null;
        this.refreshTimeout = null;
        this.eventSource = null;
    }

    get isAuthenticated() {
        return !!this.accessToken && Date.now() < this.expiresAt;
    }

    async initialize() {
        if (this.accessToken && this.refreshToken && this.expiresAt) {
            this.emit("authInitialized", { authUrl: "", qrCode: "" });
            console.log("bb");
            await this._handleAuthenticationSuccess({
                access_token: this.accessToken,
                refresh_token: this.refreshToken,
                expires_at: this.expiresAt,
            });
            console.log("aa");
            return { success: true };
        }

        try {
            const response = await axios.get(
                `${this.config.authServerUrl}/start-auth`
            );
            const { state, url } = response.data;

            const qrCode = await QRCode.toDataURL(url);
            this.emit("authInitialized", { authUrl: url, qrCode });

            this.eventSource = new EventSource(
                `${this.config.authServerUrl}/sse/${state}`
            );

            this.eventSource.onmessage = async (event) => {
                const data = JSON.parse(event.data);

                if (data.status === "keep-alive") return;

                if (data.status === "URL visited") {
                    this.emit("authUrlVisited");
                }

                if (data.status === "User logged in") {
                    this.eventSource.close();
                    await this._handleAuthenticationSuccess({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        expires_in: data.expires_in,
                    });
                    return { success: true };
                }
            };

            this.eventSource.onerror = (error) => {
                this.eventSource.close();
                console.error(
                    new Error("Authentication failed: SSE connection error")
                );
            };
        } catch (error) {
            this.emit(
                "error",
                new Error(`Auth initialization failed: ${error.message}`)
            );
            throw error;
        }
    }

    async _handleAuthenticationSuccess(tokens) {
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;
        if (!this.expiresAt) {
            this.expiresAt = Date.now() + tokens.expires_in * 1000;
        }

        setIntegration("google", {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiresAt: this.expiresAt,
        });

        if (this.config.autoRefresh) {
            this._scheduleTokenRefresh();
        }

        await this._initializeGoogleCalendar();
        this.emit("authenticated", { expiresAt: this.expiresAt });
    }

    async _refreshAccessToken() {
        try {
            const response = await axios.post(
                `${this.config.authServerUrl}/refresh-token`,
                {
                    refresh_token: this.refreshToken,
                }
            );

            this.accessToken = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            console.log(response.data);
            this.expiresAt = Date.now() + response.data.expires_in * 1000;

            if (this.config.autoRefresh) {
                this._scheduleTokenRefresh();
            }

            this.emit("tokenRefreshed", { expiresAt: this.expiresAt });
        } catch (error) {
            this.emit("error", new Error("Token refresh failed"));
            throw error;
        }
    }

    _scheduleTokenRefresh() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        const timeUntilRefresh =
            this.expiresAt -
            Date.now() -
            this.config.refreshThreshold * 1000 -
            this.config.tokenRefreshPadding * 1000;

        if (timeUntilRefresh > 0) {
            this.refreshTimeout = setTimeout(() => {
                this._refreshAccessToken().catch((error) => {
                    this.emit("error", error);
                });
            }, timeUntilRefresh);
        } else {
            this._refreshAccessToken().catch((error) => {
                this.emit("error", error);
            });
        }
    }

    async _initializeGoogleCalendar() {
        this.auth = new google.auth.OAuth2();
        this.auth.setCredentials({
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            expiry_date: this.expiresAt,
        });

        this.calendar = google.calendar({ version: "v3", auth: this.auth });
        this.emit("ready");
    }

    async _handleApiRequest(requestFn) {
        if (!this.isAuthenticated) {
            await this.initialize();
            return;
        }

        try {
            return await requestFn();
        } catch (error) {
            if (error.code === 401 && this.config.autoRefresh) {
                await this._refreshAccessToken();
                return await requestFn();
            }
            throw this._formatApiError(error);
        }
    }

    _formatApiError(error) {
        if (error.errors?.[0]?.message) {
            return new Error(
                `Google Calendar API Error: ${error.errors[0].message}`
            );
        }
        return error;
    }

    destroy() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        if (this.eventSource) {
            this.eventSource.close();
        }
        this.removeAllListeners();
        this.accessToken = null;
        this.refreshToken = null;
        this.auth = null;
        this.calendar = null;
    }

    // Calendar Operations

    async getCalendarList() {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.calendarList.list();
            console.log(response);
            return response.data.items;
        });
    }

    async getEvents(calendarId = "primary", options = {}) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.events.list({
                calendarId,
                timeMin: options.timeMin || new Date().toISOString(),
                maxResults: options.maxResults || 10,
                singleEvents: true,
                orderBy: "startTime",
                ...options,
            });
            return response.data.items;
        });
    }

    async createEvent(calendarId = "primary", event) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.events.insert({
                calendarId,
                requestBody: event,
            });
            return response.data;
        });
    }

    async updateEvent(calendarId = "primary", eventId, event) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.events.update({
                calendarId,
                eventId,
                requestBody: event,
            });
            return response.data;
        });
    }

    async deleteEvent(calendarId = "primary", eventId) {
        return this._handleApiRequest(async () => {
            await this.calendar.events.delete({
                calendarId,
                eventId,
            });
            return true;
        });
    }

    async getCalendarById(calendarId) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.calendars.get({
                calendarId,
            });
            return response.data;
        });
    }

    async createCalendar(calendar) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.calendars.insert({
                requestBody: calendar,
            });
            return response.data;
        });
    }

    async updateCalendar(calendarId, calendar) {
        return this._handleApiRequest(async () => {
            const response = await this.calendar.calendars.update({
                calendarId,
                requestBody: calendar,
            });
            return response.data;
        });
    }

    async deleteCalendar(calendarId) {
        return this._handleApiRequest(async () => {
            await this.calendar.calendars.delete({
                calendarId,
            });
            return true;
        });
    }
}
