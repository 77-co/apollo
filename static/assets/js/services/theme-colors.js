const colors = {
    blue: "#3866ff",
    purple: "#9538FF",
    pink: "#E151C2",
    red: "#FF4D4D",
    orange: "#DF8F16",
    yellow: "#C6B610",
    green: "#25CE66",
};

window.addEventListener("load", async () => {
    const themeColor = await window.backend.settings.get("ui.themeColor");
    document.body.style.setProperty("--active-bg-1", colors[themeColor]);
    if (themeColor === "red") document.body.style.setProperty("--danger-bg-1", "grey");
    else document.body.style.removeProperty("--danger-bg-1");
});

function setThemeColor(color) {
    if (colors[color]) {
        document.body.style.setProperty("--active-bg-1", colors[color]);
        window.backend.settings.set("ui.themeColor", color);
    } else {
        console.error(`Invalid theme color: ${color}`);
    }

    if (color === "red")
        document.body.style.setProperty("--danger-bg-1", "grey");
    else document.body.style.removeProperty("--danger-bg-1");
}