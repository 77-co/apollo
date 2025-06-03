class Calendar {
    constructor() {
        this.integration = new Integration('google', () => {
            // Handle logging out (unlinking account)
        });
        this.initializeGoogle();
        this.setupEventListeners();
        // this.setupAnimations();
    }

    async initializeGoogle() {
        try {
            const result = await window.backend.google.initialize();
            if (!result.success) {
                console.error('Google Calendar initialization failed:', result.error);
            }
        } catch (error) {
            console.error('Failed to initialize Google Calendar:', error);
        }
    }

    setupEventListeners() {
        window.addEventListener('calendar-event', async (e) => {
            const { event, data } = e.detail;
            
            switch (event) {
                case 'authInitialized':
                    if (data.qrCode) {
                        integrations['google'].qrcode = data.qrCode;
                    }
                    break;

                case 'authUrlVisited':
                    this.integration.confirmLogin();
                    break;

                case 'authenticated':
                    this.integration.finaliseLogin();
                    break;

                case 'ready':
                    console.log('Google ready.');
                    break;

                case 'error':
                    console.error('Google error:', data);
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
        this.sampleEvents = {
            "2025-06-03": true,
            "2025-06-08": true,
            "2025-06-15": true,
            "2025-06-22": true,
            "2025-06-28": true,
        };
        this.isAnimating = false;
        this.updateCalendar();
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
            if (this.sampleEvents[dateStr]) {
                dayElement.classList.add("has-event");
            }

            dayElement.onclick = (e) => {
                e.stopPropagation();
                console.log("Day clicked:", dateStr);
            };

            weekElement.appendChild(dayElement);
        });
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
        }, 300);
    }
}

// Initialize calendar
let calendarWidget;

document.addEventListener('DOMContentLoaded', () => {
    window.calendar = new Calendar();
    calendarWidget = new CalendarWidget();
});

function changeWeek(direction) {
    calendarWidget.changeWeek(direction);
}