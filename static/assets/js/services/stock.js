/**
 * Draws a minimal line chart on a canvas.
 * @param {HTMLCanvasElement} canvas - Target canvas element.
 * @param {number[]} data - Array of Y values.
 * @param {Object} options - Config options.
 * @param {number} [options.margin=20] - Margin from edges.
 * @param {string} [options.color="#2196f3"] - Line and point color.
 * @param {number} [options.pointRadius=3] - Radius of points.
 */
function generateChart(canvas, data, options = {}) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const margin = options.margin ?? 20;
    const color = options.color ?? "#2196f3";
    const pointRadius = options.pointRadius ?? 3;

    // Compute drawing area
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;

    // Find min/max values
    const maxY = Math.max(...data);
    const minY = Math.min(...data);
    const rangeY = maxY - minY || 1;

    const stepX = chartWidth / (data.length - 1);

    // Convert data points to canvas coords
    const points = data.map((y, i) => {
        const x = margin + i * stepX;
        const normY = (y - minY) / rangeY;
        const cy = margin + (1 - normY) * chartHeight;
        return { x, y: cy };
    });

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw points
    for (const pt of points) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function updateWidget() {
    const canvas = $("#widgetChart").get(0);
    const positive = window.getComputedStyle(canvas).getPropertyValue("--positive-chart");
    const negative = window.getComputedStyle(canvas).getPropertyValue("--negative-chart");

    const points = [10, 20, 40, 7];

    const starting = points[0];
    const latest = points[points.length - 1];
    const percentChange = Math.round(((latest - starting) / starting) * 100);

    $("#changePercent").html(`${latest < starting ? "" : "+"}${percentChange}%`);

    if (percentChange < 0) {
        $("#stock").addClass("negative");

    } else {
        $("#stock").removeClass("negative");
    }

    generateChart(canvas, points, { margin: 30, color: points[points.length - 1] < points[0] ? negative : positive });
}

document.addEventListener("DOMContentLoaded", () => {
    updateWidget();
}); 