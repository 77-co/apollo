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
        // UI Elements
        this.monthYearEl = document.getElementById("monthYear");
        this.currentWeekEl = document.getElementById("currentWeek");
        this.selectedDateEl = document.getElementById("selectedDate");
        this.selectedEventsEl = document.getElementById("selectedEvents");
        this.weekContainerEl = document.querySelector(".week-container");

        // State
        this.currentWeekStart = this.getStartOfWeek(new Date());
        this.selectedDate = new Date();
        this.events = new Map(); // Stores events by date string 'YYYY-MM-DD'
        this.isAnimating = false;
        this.isLoading = false;

        // Constants for Polish localization
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

        // Initialization
        this.loadEvents();
    }

    // --- DATA & BACKEND METHODS ---

    async loadEvents() {
        if (this.isLoading) return;
        this.isLoading = true;
        // You can add a visual loading indicator here if you want

        try {
            // This now uses the MOCK backend. Replace with your actual backend call.
            const upcomingEvents =
                await window.backend.google.getUpcomingEvents();
            console.log(upcomingEvents.result);
            this.processEvents(upcomingEvents.result);
            this.updateCalendar(); // This will render everything
        } catch (error) {
            console.error("Failed to load calendar events:", error);
            this.handleError("Nie udało się załadować wydarzeń");
        } finally {
            this.isLoading = false;
        }
    }

    processEvents(events) {
        this.events.clear();
        if (!events) return;

        events.forEach((event) => {
            let eventDate;
            if (event.start?.date) {
                // All-day event
                eventDate = new Date(event.start.date + "T00:00:00");
            } else if (event.start?.dateTime) {
                // Timed event
                eventDate = new Date(event.start.dateTime);
            } else {
                return; // Skip invalid events
            }

            const dateStr = eventDate.toISOString().split("T")[0]; // 'YYYY-MM-DD'
            if (!this.events.has(dateStr)) {
                this.events.set(dateStr, []);
            }
            this.events.get(dateStr).push({
                title: event.summary || "Brak tytułu",
                start: event.start,
                end: event.end,
                allDay: !!event.start.date,
            });
        });
    }

    // --- UI RENDERING METHODS ---

    updateCalendar() {
        // Determine the dominant month for this week
        const dominantMonth = this.getDominantMonthForWeek(
            this.currentWeekStart
        );
        this.monthYearEl.textContent = dominantMonth
            .toLocaleDateString("pl-PL", {
                month: "long",
                year: "numeric",
            })
            .replace(/^\w/, (c) => c.toUpperCase());

        this.renderWeek(this.currentWeekEl, this.currentWeekStart);
        this.renderSelectedDayEvents(); // Render the bottom panel for the selected day
    }

    getDominantMonthForWeek(weekStart) {
        const monthCounts = new Map();

        // Count days for each month in the current week
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

            monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
        }

        // Find the month with the most days
        let dominantMonthKey = null;
        let maxCount = 0;

        for (const [monthKey, count] of monthCounts) {
            if (count > maxCount) {
                maxCount = count;
                dominantMonthKey = monthKey;
            }
        }

        // Return a date object for the dominant month
        if (dominantMonthKey) {
            const [year, month] = dominantMonthKey.split("-").map(Number);
            return new Date(year, month, 1);
        }

        // Fallback to week start if something goes wrong
        return weekStart;
    }

    renderWeek(weekElement, weekStart) {
        weekElement.innerHTML = "";
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        // Get the dominant month for better styling
        const dominantMonth = this.getDominantMonthForWeek(weekStart);
        const dominantMonthNum = dominantMonth.getMonth();
        const dominantYear = dominantMonth.getFullYear();

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = date.toISOString().split("T")[0];

            const dayEl = document.createElement("div");
            dayEl.className = "day";
            dayEl.textContent = date.getDate();

            // Improved month styling logic
            const isInDominantMonth =
                date.getMonth() === dominantMonthNum &&
                date.getFullYear() === dominantYear;

            if (!isInDominantMonth) {
                dayEl.classList.add("other-month");
            }

            if (dateStr === todayStr) {
                dayEl.classList.add("today");
            }
            if (this.events.has(dateStr)) {
                dayEl.classList.add("has-event");
            }
            if (date.toDateString() === this.selectedDate.toDateString()) {
                dayEl.classList.add("selected");
            }

            dayEl.onclick = () => this.selectDay(dayEl, date);
            weekElement.appendChild(dayEl);
        }
    }

    renderSelectedDayEvents() {
        // Fade out old events by removing content immediately
        this.selectedEventsEl.innerHTML = "";
        this.selectedEventsEl.classList.remove("fade-in");

        const date = this.selectedDate;
        const formattedDate = `${
            this.dayNames[date.getDay()]
        }, ${date.getDate()} ${this.monthNames[date.getMonth()]}`;
        this.selectedDateEl.textContent = formattedDate;

        const dateStr = date.toISOString().split("T")[0];
        const dayEvents = this.events.get(dateStr) || [];

        // Use a timeout to allow the DOM to clear before adding new content and the animation class
        setTimeout(() => {
            if (dayEvents.length > 0) {
                // Sort events by time for a better display
                dayEvents.sort((a, b) => {
                    if (a.allDay) return -1;
                    if (b.allDay) return 1;
                    return (
                        new Date(a.start.dateTime) - new Date(b.start.dateTime)
                    );
                });

                dayEvents.forEach((event) => {
                    const eventEl = document.createElement("div");
                    eventEl.className = "event";

                    const timeStr = event.allDay
                        ? "Cały dzień"
                        : new Date(event.start.dateTime).toLocaleTimeString(
                              "pl-PL",
                              { hour: "2-digit", minute: "2-digit" }
                          );

                    eventEl.innerHTML = `
                        <span class="event-time">${timeStr}</span>
                        <span class="event-title">${event.title}</span>
                    `;
                    this.selectedEventsEl.appendChild(eventEl);
                });
            } else {
                this.selectedEventsEl.innerHTML = `<div class="no-events">Brak wydarzeń na ten dzień.</div>`;
            }
            // Add class to trigger fade-in animation
            this.selectedEventsEl.classList.add("fade-in");
        }, 50); // A small delay is enough
    }

    // --- USER INTERACTION & ANIMATION ---

    selectDay(dayEl, date) {
        // Update state
        this.selectedDate = date;

        // Update UI
        const currentlySelected =
            this.currentWeekEl.querySelector(".day.selected");
        if (currentlySelected) {
            currentlySelected.classList.remove("selected");
        }
        dayEl.classList.add("selected");

        // Render the events for the newly selected day
        this.renderSelectedDayEvents();
    }

    changeWeek(direction) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + direction * 7);

        const newWeekEl = document.createElement("div");
        newWeekEl.className = "week";
        this.renderWeek(newWeekEl, newWeekStart);

        // Position new week for entry animation
        newWeekEl.style.transform = `translateX(${direction * 100}%)`;
        this.weekContainerEl.appendChild(newWeekEl);

        // Animate!
        requestAnimationFrame(() => {
            this.currentWeekEl.style.transform = `translateX(${
                -direction * 100
            }%)`;
            newWeekEl.style.transform = "translateX(0)";
        });

        // Clean up after animation
        setTimeout(() => {
            this.currentWeekStart = newWeekStart;
            this.currentWeekEl.remove();
            newWeekEl.id = "currentWeek";
            this.currentWeekEl = newWeekEl; // Update reference

            // Update month/year header after switching using the improved logic
            const dominantMonth = this.getDominantMonthForWeek(
                this.currentWeekStart
            );
            this.monthYearEl.textContent = dominantMonth
                .toLocaleDateString("pl-PL", {
                    month: "long",
                    year: "numeric",
                })
                .replace(/^\w/, (c) => c.toUpperCase());

            this.isAnimating = false;
        }, 400); // Must match CSS transition duration
    }

    // --- HELPERS & UTILITIES ---

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 0); // Adjust for Monday as start of week
        return new Date(d.setDate(diff));
    }

    handleError(message) {
        const errorElement = document.getElementById("calendar-error");
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = "block";
            setTimeout(() => {
                errorElement.style.display = "none";
            }, 5000);
        }
    }
}

// --- INITIALIZATION ---

// Global instance of the widget
let calendarWidget;

// Mock Backend - REMOVE THIS SECTION WHEN USING YOUR REAL BACKEND
// IGNORE_WHEN_COPYING_START
window.backend = {
    google: {
        getUpcomingEvents: async () => {
            console.log("Using Mock Backend for Events");
            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            return [
                {
                    summary: "Spotkanie projektowe",
                    start: { dateTime: new Date().setHours(10, 0, 0) },
                },
                {
                    summary: "Lunch z klientem",
                    start: { dateTime: new Date().setHours(13, 30, 0) },
                },
                {
                    summary: "Wizyta u dentysty",
                    start: { dateTime: tomorrow.setHours(15, 0, 0) },
                },
                {
                    summary: "Dzień wolny",
                    start: { date: nextWeek.toISOString().split("T")[0] },
                },
            ];
        },
    },
};
// IGNORE_WHEN_COPYING_END

document.addEventListener("DOMContentLoaded", () => {
    window.calendar = new Calendar();
    calendarWidget = new CalendarWidget();
});

// Make changeWeek globally accessible for the HTML onclick attribute
function changeWeek(direction) {
    if (calendarWidget) {
        calendarWidget.changeWeek(direction);
    }
}