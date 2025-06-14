class Calendar {
    constructor() {
        this.integration = new Integration("google", () => {
            // Handle logging out (unlinking account)
            window.backend.google.destroy();
            window.backend.integrations.deintegrate("google");
        });
        this.initializeGoogle();
        this.setupEventListeners();
        // this.setupAnimations();
    }

    async initializeGoogle() {
        try {
            const result = await window.backend.google.initialize();
            if (!result.success) {
                console.error(
                    "Google Calendar initialization failed:",
                    result.error
                );
            } else {
                console.log(await window.backend.google.getUpcomingEvents());
                // Notify calendar widget that events are available
                window.dispatchEvent(
                    new CustomEvent("calendar-events-updated")
                );
            }
        } catch (error) {
            console.error("Failed to initialize Google Calendar:", error);
        }
    }

    setupEventListeners() {
        window.addEventListener("calendar-event", async (e) => {
            const { event, data } = e.detail;

            switch (event) {
                case "authInitialized":
                    if (data.qrCode) {
                        integrations["google"].qrcode = data.qrCode;
                    }
                    break;

                case "authUrlVisited":
                    this.integration.confirmLogin();
                    break;

                case "authenticated":
                    this.integration.finaliseLogin();
                    break;

                case "ready":
                    console.log("Google ready.");
                    // Refresh calendar widget events when ready
                    window.dispatchEvent(
                        new CustomEvent("calendar-events-updated")
                    );
                    break;

                case "error":
                    console.error("Google error:", data);
                    break;
            }
        });
    }
}

class CalendarWidget {
    constructor() {
        this.currentWeekStart = this.getWeekStart(new Date());
        this.monthNames = [
            "Styczeń",
            "Luty",
            "Marzec",
            "Kwiecień",
            "Maj",
            "Czerwiec",
            "Lipiec",
            "Sierpień",
            "Wrzesień",
            "Październik",
            "Listopad",
            "Grudzień",
        ];
        this.dayNames = [
            "Niedziela",
            "Poniedziałek",
            "Wtorek",
            "Środa",
            "Czwartek",
            "Piątek",
            "Sobota",
        ];
        this.events = new Map(); // Store events by date
        this.isAnimating = false;
        this.isLoading = false;

        this.setupEventListeners();
        this.loadEvents();
        this.updateCalendar();
    }

    setupEventListeners() {
        // Listen for calendar events updates
        window.addEventListener("calendar-events-updated", () => {
            this.loadEvents();
        });

        // Listen for calendar backend events
        window.addEventListener("calendar-event", (e) => {
            const { event, data } = e.detail;

            switch (event) {
                case "ready":
                    this.loadEvents();
                    break;
                case "error":
                    console.error("Calendar backend error:", data);
                    this.handleError("Failed to load calendar events");
                    break;
            }
        });
    }

    async loadEvents() {
        if (this.isLoading) return;

        try {
            this.isLoading = true;
            this.showLoadingState();

            const upcomingEvents =
                await window.backend.google.getUpcomingEvents();

            if (upcomingEvents && upcomingEvents.length > 0) {
                this.processEvents(upcomingEvents);
                this.updateCalendar();
                this.hideLoadingState();
            } else {
                // No events or not authenticated
                this.events.clear();
                this.updateCalendar();
                this.hideLoadingState();
            }
        } catch (error) {
            console.error("Failed to load calendar events:", error);
            this.handleError("Failed to load calendar events");
            this.hideLoadingState();
        } finally {
            this.isLoading = false;
        }
    }

    processEvents(events) {
        this.events.clear();

        events.forEach((event) => {
            try {
                // Handle different date formats from Google Calendar
                let eventDate;

                if (event.start && event.start.date) {
                    // All-day event
                    eventDate = new Date(event.start.date + "T00:00:00");
                } else if (event.start && event.start.dateTime) {
                    // Timed event
                    eventDate = new Date(event.start.dateTime);
                } else {
                    console.warn("Event has no valid date:", event);
                    return;
                }

                const dateStr = eventDate.toISOString().split("T")[0];

                if (!this.events.has(dateStr)) {
                    this.events.set(dateStr, []);
                }

                this.events.get(dateStr).push({
                    id: event.id,
                    title: event.summary || "Untitled Event",
                    start: event.start,
                    end: event.end,
                    allDay: !!event.start.date,
                    location: event.location,
                    description: event.description,
                });
            } catch (error) {
                console.error("Error processing event:", event, error);
            }
        });
    }

    showLoadingState() {
        const calendarElement = document.querySelector(".calendar-container");
        if (calendarElement) {
            calendarElement.classList.add("loading");
        }
    }

    hideLoadingState() {
        const calendarElement = document.querySelector(".calendar-container");
        if (calendarElement) {
            calendarElement.classList.remove("loading");
        }
    }

    handleError(message) {
        // You can implement error display UI here
        console.error(message);

        // Optionally show error message to user
        const errorElement = document.getElementById("calendar-error");
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = "block";

            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = "none";
            }, 5000);
        }
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }

    createWeek(weekStart) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            week.push(date);
        }
        return week;
    }

    renderWeek(weekElement, weekStart) {
        const week = this.createWeek(weekStart);
        weekElement.innerHTML = "";

        week.forEach((date) => {
            const dayElement = document.createElement("div");
            dayElement.className = "day";
            dayElement.textContent = date.getDate();

            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayElement.classList.add("today");
            }

            const dateStr = date.toISOString().split("T")[0];
            const dayEvents = this.events.get(dateStr);

            if (dayEvents && dayEvents.length > 0) {
                dayElement.classList.add("has-event");

                // Add event count indicator if multiple events
                if (dayEvents.length > 1) {
                    const eventCount = document.createElement("span");
                    eventCount.className = "event-count";
                    eventCount.textContent = dayEvents.length;
                    dayElement.appendChild(eventCount);
                }

                // Add tooltip with event titles
                const eventTitles = dayEvents.map((e) => e.title).join("\n");
                dayElement.title = eventTitles;
            }

            dayElement.onclick = (e) => {
                e.stopPropagation();
                this.showDayEvents(date, dayEvents);
            };

            weekElement.appendChild(dayElement);
        });
    }

    showDayEvents(date, events) {
        const dateStr = date.toLocaleDateString("pl-PL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        console.log(`Events for ${dateStr}:`, events);

        // You can implement a modal or sidebar to show event details
        if (events && events.length > 0) {
            // For now, just log the events
            events.forEach((event) => {
                console.log(
                    `- ${event.title}`,
                    event.allDay
                        ? "(All day)"
                        : `${new Date(event.start.dateTime).toLocaleTimeString(
                              "pl-PL",
                              {
                                  hour: "2-digit",
                                  minute: "2-digit",
                              }
                          )}`
                );
            });
        } else {
            console.log("No events for this day");
        }

        // Dispatch custom event for other components to handle
        window.dispatchEvent(
            new CustomEvent("day-selected", {
                detail: { date, events: events || [] },
            })
        );
    }

    updateCalendar() {
        // Update month/year display
        const monthYear = this.currentWeekStart.toLocaleDateString("pl-PL", {
            month: "long",
            year: "numeric",
        });
        document.getElementById("monthYear").textContent =
            monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

        // Update today's date
        const today = new Date();
        const todayStr = `${
            this.dayNames[today.getDay()]
        }, ${today.getDate()} ${this.monthNames[today.getMonth()]}`;
        document.getElementById("todayDate").textContent = todayStr;

        // Render current week
        this.renderWeek(
            document.getElementById("currentWeek"),
            this.currentWeekStart
        );
    }

    changeWeek(direction) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const currentWeek = document.getElementById("currentWeek");

        // Create new week element for animation
        const newWeek = document.createElement("div");
        newWeek.className = "week";
        newWeek.style.transform =
            direction > 0 ? "translateX(100%)" : "translateX(-100%)";

        // Calculate new week start
        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + direction * 7);

        // Render new week
        this.renderWeek(newWeek, newWeekStart);

        // Add to container
        currentWeek.parentNode.appendChild(newWeek);

        // Animate
        requestAnimationFrame(() => {
            currentWeek.style.transform =
                direction > 0 ? "translateX(-100%)" : "translateX(100%)";
            newWeek.style.transform = "translateX(0)";
        });

        setTimeout(() => {
            // Update current week start
            this.currentWeekStart = newWeekStart;

            // Replace current week
            currentWeek.remove();
            newWeek.id = "currentWeek";

            // Update month display
            const monthYear = this.currentWeekStart.toLocaleDateString(
                "pl-PL",
                {
                    month: "long",
                    year: "numeric",
                }
            );
            document.getElementById("monthYear").textContent =
                monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

            this.isAnimating = false;

            // Load events for new week if needed
            this.checkAndLoadEventsForWeek(newWeekStart);
        }, 300);
    }

    checkAndLoadEventsForWeek(weekStart) {
        // Check if we need to load more events for the new week
        const week = this.createWeek(weekStart);
        const hasEventsForWeek = week.some((date) => {
            const dateStr = date.toISOString().split("T")[0];
            return this.events.has(dateStr);
        });

        // If no events for this week and we're not already loading, refresh events
        if (!hasEventsForWeek && !this.isLoading) {
            this.loadEvents();
        }
    }

    // Method to refresh events (can be called externally)
    refreshEvents() {
        this.loadEvents();
    }

    // Get events for a specific date
    getEventsForDate(date) {
        const dateStr = date.toISOString().split("T")[0];
        return this.events.get(dateStr) || [];
    }
}

// Initialize calendar
let calendarWidget;

document.addEventListener("DOMContentLoaded", () => {
    window.calendar = new Calendar();
    calendarWidget = new CalendarWidget();
});

function changeWeek(direction) {
    calendarWidget.changeWeek(direction);
}

// Export for external use
window.calendarWidget = calendarWidget;
