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

async function updateWidget() {
    const canvas = $("#widgetChart").get(0);
    const positive = window.getComputedStyle(canvas).getPropertyValue("--positive-chart");
    const negative = window.getComputedStyle(canvas).getPropertyValue("--negative-chart");

    try {
        // Show loading state
        $("#stock").addClass("loading");
        $("#changePercent").html("Loading...");

        // Get Apple's current quote
        const quoteResponse = await window.backend.stock.getQuote("AAPL");
        
        if (!quoteResponse.success) {
            throw new Error(quoteResponse.error || "Failed to get quote");
        }

        const quote = quoteResponse.data;

        // Get historical data for the past 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const historicalResponse = await window.backend.stock.getHistoricalData("AAPL", {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        if (!historicalResponse.success) {
            throw new Error(historicalResponse.error || "Failed to get historical data");
        }

        const historical = historicalResponse.data;
        
        // Extract closing prices from historical data
        const points = historical.data.map(item => item.close);
        
        // Fallback to current quote if no historical data
        if (points.length === 0) {
            points.push(quote.price);
        }

        // Calculate percentage change
        const starting = points[0];
        const latest = quote.price; // Use current price as latest
        const percentChange = ((latest - starting) / starting) * 100;

        // Update UI with actual data
        $("#changePercent").html(`${latest < starting ? "" : "+"}${percentChange.toFixed(2)}%`);
        
        // Update stock price display if element exists
        if ($("#stockPrice").length) {
            $("#stockPrice").html(`$${latest.toFixed(2)}`);
        }
        
        // Update stock name if element exists
        if ($("#stockName").length) {
            $("#stockName").html(quote.name || "Apple Inc.");
        }

        // Apply positive/negative styling
        if (percentChange < 0) {
            $("#stock").addClass("negative");
        } else {
            $("#stock").removeClass("negative");
        }

        // Use actual closing prices for chart, add current price as latest point
        const chartData = [...points];
        if (chartData[chartData.length - 1] !== latest) {
            chartData.push(latest);
        }

        // Generate chart with actual data
        generateChart(canvas, chartData, { 
            margin: 30, 
            color: latest < starting ? negative : positive 
        });

        // Remove loading state
        $("#stock").removeClass("loading");

        console.log("Apple stock data updated:", {
            symbol: quote.symbol,
            price: latest,
            change: quote.change,
            changePercent: percentChange,
            dataPoints: chartData.length
        });

    } catch (error) {
        console.error("Failed to update stock widget:", error);
        
        // Remove loading state and show error
        $("#stock").removeClass("loading");
        $("#changePercent").html("Error");
        
        // Fallback to dummy data
        const fallbackData = [220, 225, 230, 228, 235, 240, 238];
        const starting = fallbackData[0];
        const latest = fallbackData[fallbackData.length - 1];
        const percentChange = ((latest - starting) / starting) * 100;
        
        generateChart(canvas, fallbackData, { 
            margin: 30, 
            color: latest < starting ? negative : positive 
        });
        
        // Show fallback percentage
        setTimeout(() => {
            $("#changePercent").html(`${latest < starting ? "" : "+"}${percentChange.toFixed(2)}%`);
        }, 1000);
    }
}

// Auto-refresh the widget every 5 minutes during market hours
let refreshInterval;

function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Check if market is open and set appropriate refresh rate
    window.backend.stock.isMarketOpen().then(response => {
        if (response.success && response.data.isOpen) {
            // Refresh every 1 minute during market hours
            refreshInterval = setInterval(updateWidget, 60000);
            console.log("Auto-refresh enabled (market open): every 1 minute");
        } else {
            // Refresh every 5 minutes when market is closed
            refreshInterval = setInterval(updateWidget, 300000);
            console.log("Auto-refresh enabled (market closed): every 5 minutes");
        }
    }).catch(() => {
        // Default to 5 minutes if market status check fails
        refreshInterval = setInterval(updateWidget, 300000);
        console.log("Auto-refresh enabled (fallback): every 5 minutes");
    });
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log("Auto-refresh disabled");
    }
}

// Manual refresh function
function refreshStock() {
    updateWidget();
}

// Visibility change handler to pause/resume updates
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    updateWidget();
    startAutoRefresh();
});

// Cleanup on window unload
window.addEventListener("beforeunload", () => {
    stopAutoRefresh();
});

// Expose functions globally for debugging/manual control
window.stockWidget = {
    update: updateWidget,
    refresh: refreshStock,
    startAutoRefresh,
    stopAutoRefresh
};