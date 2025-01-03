let city = 'Poznan';

const weatherApp = document.getElementById('weatherApp');
let summaryDone = false;

weatherApp.addEventListener('appopen', () => {
    if ($('#weatherSummary').html().length === 0 && !summaryDone) summariseWeather();
});

async function updateWeather() {
    const translations = {
        /* Thunderstorm */
        "thunderstorm with light rain": "burza z lekkim deszczem",
        "thunderstorm with rain": "burza z deszczem",
        "thunderstorm with heavy rain": "burza z intensywnym deszczem",
        "light thunderstorm": "lekka burza",
        "thunderstorm": "burza",
        "heavy thunderstorm": "silna burza",
        "ragged thunderstorm": "nieregularna burza",
        "thunderstorm with light drizzle": "burza z lekką mżawką",
        "thunderstorm with drizzle": "burza z mżawką",
        "thunderstorm with heavy drizzle": "burza z intensywną mżawką",

        /* Drizzle */
        "light intensity drizzle": "lekka mżawka",
        "drizzle": "mżawka",
        "heavy intensity drizzle": "intensywna mżawka",
        "light intensity drizzle rain": "lekka mżawka z deszczem",
        "drizzle rain": "mżawka z deszczem",
        "heavy intensity drizzle rain": "intensywna mżawka z deszczem",
        "shower rain and drizzle": "przelotny deszcz z mżawką",
        "heavy shower rain and drizzle": "intensywny deszcz z mżawką",
        "shower drizzle": "przelotna mżawka",

        /* Rain */
        "light rain": "lekki deszcz",
        "moderate rain": "umiarkowany deszcz",
        "heavy intensity rain": "intensywny deszcz",
        "very heavy rain": "bardzo intensywny deszcz",
        "extreme rain": "ekstremalny deszcz",
        "freezing rain": "deszcz lodowy",
        "light intensity shower rain": "lekki przelotny deszcz",
        "shower rain": "przelotny deszcz",
        "heavy intensity shower rain": "intensywny przelotny deszcz",
        "ragged shower rain": "nieregularny przelotny deszcz",

        /* Snow */
        "light snow": "lekki śnieg",
        "snow": "śnieg",
        "heavy snow": "dużo śniegu",
        "sleet": "deszcz ze śniegiem",
        "light shower sleet": "lekkie opady deszczu ze śniegiem",
        "shower sleet": "przelotne opady deszczu ze śniegiem",
        "light rain and snow": "lekki deszcz ze śniegiem",
        "rain and snow": "deszcz i śnieg",
        "light shower snow": "lekkie przelotne opady śniegu",
        "shower snow": "przelotne opady śniegu",
        "heavy shower snow": "intensywne przelotne opady śniegu",

        /* Atmosphere */
        "mist": "mgła",
        "smoke": "smog",
        "haze": "zamglenie",
        "sand/dust whirls": "wirujący piasek/pył",
        "fog": "mgła",
        "sand": "piasek",
        "dust": "pył",
        "volcanic ash": "popiół wulkaniczny",
        "squalls": "porywy wiatru",
        "tornado": "tornado",

        /* Clouds */
        "clear sky": "czyste niebo",
        "few clouds": "trochę chmur",
        "scattered clouds": "rozproszone chmury",
        "broken clouds": "pochmurnie",
        "overcast clouds": "zachmurzenie"
    };

    const backgrounds = {
        /* Thunderstorm */
        "thunderstorm with light rain": "var(--stormy)",
        "thunderstorm with rain": "var(--stormy)",
        "thunderstorm with heavy rain": "var(--stormy)",
        "light thunderstorm": "var(--stormy)",
        "thunderstorm": "var(--thunderstorm)",
        "heavy thunderstorm": "var(--thunderstorm)",
        "ragged thunderstorm": "var(--stormy)",
        "thunderstorm with light drizzle": "var(--stormy)",
        "thunderstorm with drizzle": "var(--stormy)",
        "thunderstorm with heavy drizzle": "var(--stormy)",

        /* Drizzle */
        "light intensity drizzle": "var(--rainy)",
        "drizzle": "var(--rainy)",
        "heavy intensity drizzle": "var(--rainy)",
        "light intensity drizzle rain": "var(--rainy)",
        "drizzle rain": "var(--rainy)",
        "heavy intensity drizzle rain": "var(--rainy)",
        "shower rain and drizzle": "var(--rainy)",
        "heavy shower rain and drizzle": "var(--rainy)",
        "shower drizzle": "var(--rainy)",

        /* Rain */
        "light rain": "var(--rainy)",
        "moderate rain": "var(--rainy)",
        "heavy intensity rain": "var(--rainy)",
        "very heavy rain": "var(--rainy)",
        "extreme rain": "var(--rainy)",
        "freezing rain": "var(--icy)",
        "light intensity shower rain": "var(--rainy)",
        "shower rain": "var(--rainy)",
        "heavy intensity shower rain": "var(--rainy)",
        "ragged shower rain": "var(--rainy)",

        /* Snow */
        "light snow": "var(--snowy)",
        "snow": "var(--snowy)",
        "heavy snow": "var(--snowy)",
        "sleet": "var(--snowy)",
        "light shower sleet": "var(--snowy)",
        "shower sleet": "var(--snowy)",
        "light rain and snow": "var(--snowy)",
        "rain and snow": "var(--snowy)",
        "light shower snow": "var(--snowy)",
        "shower snow": "var(--snowy)",
        "heavy shower snow": "var(--snowy)",

        /* Atmosphere */
        "mist": "var(--cloudy)",
        "smoke": "var(--foggy)",
        "haze": "var(--foggy)",
        "sand/dust whirls": "var(--dusty)",
        "fog": "var(--foggy)",
        "sand": "var(--dusty)",
        "dust": "var(--dusty)",
        "volcanic ash": "var(--ash)",
        "squalls": "var(--windy)",
        "tornado": "var(--stormy)",

        /* Clouds */
        "clear sky": "var(--sunny)",
        "few clouds": "var(--cloudy)",
        "scattered clouds": "var(--cloudy)",
        "broken clouds": "var(--cloudy)",
        "overcast clouds": "var(--cloudy)"
    };

    try {
        const weatherData = await window.backend.weather.getComplete({ 
            location: city,
            units: 'celsius',
            forecast_days: 3,
            historical_days: 0
        });

        const current = weatherData.data.current;
        const weatherWidget = document.getElementById('weather');
        if (weatherWidget) {
            const description = translations[current.condition.description.toLowerCase()] || current.condition.description.toLowerCase();
            weatherWidget.querySelector('h1').textContent = `${Math.round(current.temperature.value)}° ${description}`;
            $('#weatherApp .currentTemperature').html(`${Math.round(current.temperature.value)}°`);
            $('#weatherApp .currentState').html(capitaliseFirstLetter(description));

            // Apply a correct widget and app background according to the current weather.
            document.documentElement.style.cssText = `--active-weather-background: ${backgrounds[current.condition.description.toLowerCase()] || 'var(--cloudy)'}`;
        }

        const forecast = weatherData.data.forecast;
        const forecastContainer = weatherWidget.querySelector('.forecast');
        forecastContainer.innerHTML = '';

        const dayForecast = forecast.slice(0, 8);

        dayForecast.forEach(entry => {
            const forecastTime = new Date(entry.timestamp);
            const hour = forecastTime.getHours();
            const temperature = Math.round(entry.temperature.value);
            const conditionDescription = entry.condition.description.toLowerCase();
            const translatedDescription = translations[conditionDescription] || conditionDescription;

            let iconName = 'partly_cloudy_day';
            switch (conditionDescription) {
                case 'clear sky':
                    iconName = 'clear_day';
                    break;
                case 'rain':
                    iconName = 'rainy';
                    break;
                case 'snow':
                    iconName = 'cloudy_snowing';
                    break;
                case 'thunderstorm':
                    iconName = 'thunderstorm';
                    break;
                case 'overcast clouds':
                case 'broken clouds':
                case 'scattered clouds':
                case 'few clouds':
                    iconName = 'cloudy';
                    break;
            }

            const forecastDiv = document.createElement('div');
            forecastDiv.innerHTML = `
                <span>${hour}:00</span>
                <span class="material-symbols-outlined fill">${iconName}</span>
                <span>${temperature}°C</span>
            `;

            forecastContainer.appendChild(forecastDiv);
        });

        $('#weatherSummary').html('');
    } catch (error) {
        console.error('Error updating weather:', error);
    }
}

updateWeather();
setInterval(updateWeather, 3600000);

function summariseWeather() {
    summaryDone = true;
    let time;
    const now = new Date();
    const hours = now.getHours();
    if (hours < 6 || hours >= 21) time = 'rano';
    else if (hours < 12) time = 'w południe';
    else if (hours < 18) time = 'popołudnieu';
    else time = 'wieczorem';

    const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
    const dayName = days[now.getDay()];

    const prompt = `Podsumuj teraźniejszą prognozę pogody, ${time} oraz na kolejne 3 dni tygodnia (podaj nazwy dni tygodnia, zacznij od jutra. Dzisiejszy dzień tygodnia to ${dayName}) dla miejscowości: "${city}". Podziel podsumowanie na maks. 2 akapity. Użyj max. 90 słów. Zawrzyj twarde dane tj. niże i wyże temperatury, wiatr w km/h, temperaturę odczuwalną. Używaj liczb całkowitych i zapisuj je numerycznie. Dodaj krótką poradę dotyczącą ubioru lub akcesoriów na dzisiaj ${time}, w zależności od pogody. Jeżeli nie uda ci się uzyskać informacji o pogodzie, krótko przeproś (za brak możliwości podsumowania) i nie oferuj dalszej pomocy.`;
    const id = 'weather-summary';
    window.backend.assistant.streamMessage(prompt, id)
        .then(() => {
            console.log("Streaming completed successfully.");
        })
        .catch((error) => {
            console.error("Streaming error:", error);
        });

    $('#weatherSummary').html('');
    // Listen for the assistant-chunk events on the window object
    window.addEventListener(`${id}-assistant-chunk`, (event) => {
        const chunk = event.detail;

        if (chunk.content) {
            const content = `<span class="animated-word">${chunk.content}</span>`.replace(/\n/g, "<br />");

            // Insert the content as a span into the #weatherSummary element
            $('#weatherSummary').append(content);

            // Animate each new chunk without affecting previous animations
            anime({
                targets: '#weatherSummary .animated-word:not(.animated)', // Only animate new words
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutQuad',
            });

            $('#weatherSummary .animated-word:not(.animated)').addClass('animated');
        }
    });
}

function capitaliseFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}