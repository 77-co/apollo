class DynamicIslandNotification {
    constructor() {
        this.container = null;
        this.queue = [];
        this.activeNotifications = new Map();
        this.defaults = {
            duration: 4000,
            type: "default",
            icon: "🔔",
            persistent: false,
        };
        this.init();
    }

    init() {
        if (this.container) return;

        this.container = document.createElement("div");
        this.container.className = "din-container";
        document.body.appendChild(this.container);
    }

    show(options) {
        const config = { ...this.defaults, ...options };
        const id = this.generateId();

        const notification = this.createNotification(id, config);
        this.container.appendChild(notification);
        this.activeNotifications.set(id, { element: notification, config });

        // Show animation
        setTimeout(() => {
            notification.classList.add("din-show", "din-pulse");

            // Auto-expand after initial show
            setTimeout(() => {
                if (this.activeNotifications.has(id)) {
                    notification.classList.add("din-expand");
                }
            }, 100);

            // Auto-hide (if not persistent)
            if (config.duration > 0) {
                setTimeout(() => {
                    this.hide(id);
                }, config.duration + 100);
            }
        }, 20);

        return id;
    }

    createNotification(id, config) {
        const notification = document.createElement("div");
        notification.className = `din-notification din-${config.type}`;
        notification.dataset.id = id;

        const icon = document.createElement("div");
        icon.className = "din-icon";
        icon.textContent = config.icon;

        const content = document.createElement("div");
        content.className = "din-content";

        if (config.title) {
            const title = document.createElement("div");
            title.className = "din-title";
            title.textContent = config.title;
            content.appendChild(title);
        }

        const message = document.createElement("div");
        message.className = "din-message";
        message.textContent = config.message;
        content.appendChild(message);

        const closeBtn = document.createElement("button");
        closeBtn.className = "din-close";
        closeBtn.innerHTML = "×";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.hide(id);
        };

        notification.appendChild(icon);
        notification.appendChild(content);
        notification.appendChild(closeBtn);

        // Click handler
        notification.onclick = () => {
            if (config.onClick) {
                config.onClick();
            } else if (!notification.classList.contains("din-expand")) {
                notification.classList.add("din-expand");
            }
        };

        return notification;
    }

    hide(id) {
        const notificationData = this.activeNotifications.get(id);
        if (!notificationData) return;

        const { element, config } = notificationData;
        element.classList.add("din-hide");

        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.activeNotifications.delete(id);

            if (config.onClose) {
                config.onClose();
            }
        }, 400);
    }

    clearAll() {
        this.activeNotifications.forEach((_, id) => {
            this.hide(id);
        });
    }

    setDefaults(options) {
        this.defaults = { ...this.defaults, ...options };
    }

    generateId() {
        return "din_" + Math.random().toString(36).substr(2, 9) + Date.now();
    }
}

window.addEventListener("load", () => {
    window.toast = new DynamicIslandNotification();
    window.toast.init();
});

function notif() {
    window.toast.show({
        title: "Test123",
        message: "You have received a new notification, test1234.",
        icon: "📱",
        type: "info",
        duration: 5000,
        persistent: false,
        onClick: () => console.log("Clicked!"),
    });
}