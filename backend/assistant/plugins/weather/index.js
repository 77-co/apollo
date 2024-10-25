import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';

if (!OPENWEATHER_API_KEY) {
    throw new Error('OpenWeatherMap API key not found in environment variables');
}

const geoCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function getCoordinates(location) {
    const cacheKey = location.toLowerCase();
    
    if (geoCache.has(cacheKey)) {
        const { data, timestamp } = geoCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
        geoCache.delete(cacheKey);
    }

    const response = await axios.get(GEO_URL, {
        params: {
            q: location,
            limit: 1,
            appid: OPENWEATHER_API_KEY
        }
    });

    if (!response.data.length) {
        throw new Error(`Location "${location}" not found`);
    }

    const data = response.data[0];
    geoCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

async function getCurrentWeather(lat, lon, units) {
    const response = await axios.get(`${BASE_URL}/weather`, {
        params: {
            lat,
            lon,
            appid: OPENWEATHER_API_KEY,
            units
        }
    });
    return response.data;
}

async function getForecast(lat, lon, units) {
    const response = await axios.get(`${BASE_URL}/forecast`, {
        params: {
            lat,
            lon,
            appid: OPENWEATHER_API_KEY,
            units
        }
    });
    return response.data;
}

async function getHistorical(lat, lon, units, timestamp) {
    const response = await axios.get(`${BASE_URL}/timemachine`, {
        params: {
            lat,
            lon,
            dt: Math.floor(timestamp / 1000),
            appid: OPENWEATHER_API_KEY,
            units
        }
    });
    return response.data;
}

export default {
    async execute({ 
        location, 
        units = 'celsius',
        include_forecast = false,
        forecast_days = 5,
        include_historical = false,
        historical_days = 5
    }) {
        try {
            const apiUnits = units === 'celsius' ? 'metric' : 'imperial';
            
            const { lat, lon, name: cityName, country } = await getCoordinates(location);

            const currentWeather = await getCurrentWeather(lat, lon, apiUnits);
            
            const response = {
                location: {
                    name: cityName,
                    country,
                    coordinates: { lat, lon }
                },
                current: {
                    temperature: {
                        value: currentWeather.main.temp,
                        units: units,
                        feels_like: currentWeather.main.feels_like
                    },
                    condition: {
                        main: currentWeather.weather[0].main,
                        description: currentWeather.weather[0].description,
                        icon: currentWeather.weather[0].icon
                    },
                    humidity: currentWeather.main.humidity,
                    wind: {
                        speed: currentWeather.wind.speed,
                        direction: currentWeather.wind.deg
                    },
                    pressure: currentWeather.main.pressure,
                    timestamp: new Date(currentWeather.dt * 1000).toISOString()
                }
            };

            if (include_forecast) {
                const forecast = await getForecast(lat, lon, apiUnits);
                response.forecast = forecast.list
                    .slice(0, forecast_days * 8)
                    .map(item => ({
                        temperature: {
                            value: item.main.temp,
                            units: units,
                            feels_like: item.main.feels_like
                        },
                        condition: {
                            main: item.weather[0].main,
                            description: item.weather[0].description,
                            icon: item.weather[0].icon
                        },
                        humidity: item.main.humidity,
                        timestamp: new Date(item.dt * 1000).toISOString()
                    }));
            }

            if (include_historical) {
                response.historical = [];
                const now = Date.now();
                for (let i = 1; i <= historical_days; i++) {
                    const timestamp = now - (i * 24 * 60 * 60 * 1000);
                    const historicalData = await getHistorical(lat, lon, apiUnits, timestamp);
                    response.historical.push({
                        temperature: {
                            value: historicalData.current.temp,
                            units: units,
                            feels_like: historicalData.current.feels_like
                        },
                        condition: {
                            main: historicalData.current.weather[0].main,
                            description: historicalData.current.weather[0].description,
                            icon: historicalData.current.weather[0].icon
                        },
                        humidity: historicalData.current.humidity,
                        timestamp: new Date(historicalData.current.dt * 1000).toISOString()
                    });
                }
            }

            return response;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Location "${location}" not found`);
            }
            throw new Error(`Failed to fetch weather data: ${error.message}`);
        }
    }
}