import { WeatherData } from '../types';

// ── In-memory cache to prevent excessive API calls ──
let cachedWeather: WeatherData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Map Open-Meteo WMO weather code to a description + OWM-compatible icon code.
 */
function mapWeatherCode(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Clear Sky', icon: '01d' };
  if (code <= 2) return { description: 'Partly Cloudy', icon: '02d' };
  if (code === 3) return { description: 'Overcast', icon: '04d' };
  if (code <= 49) return { description: 'Foggy', icon: '50d' };
  if (code <= 67) return { description: 'Drizzle / Rain', icon: '10d' };
  if (code <= 77) return { description: 'Snow', icon: '13d' };
  if (code <= 82) return { description: 'Rain Showers', icon: '09d' };
  if (code <= 99) return { description: 'Thunderstorm', icon: '11d' };
  return { description: 'Unknown', icon: '01d' };
}

/**
 * Fetch current weather from Open-Meteo API.
 * - Free, no API key required, CORS-enabled.
 * - Lat/Lon: Mumbai, India (19.076°N, 72.877°E) — same as existing backend logic.
 * - Caches for 10 minutes to prevent flicker and excessive calls.
 */
export const fetchWeather = async (): Promise<WeatherData> => {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedWeather && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedWeather;
  }

  try {
    const url = [
      'https://api.open-meteo.com/v1/forecast',
      '?latitude=19.076',
      '&longitude=72.877',
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,',
      'surface_pressure,cloud_cover,wind_speed_10m,shortwave_radiation,weather_code',
      '&wind_speed_unit=ms',
      '&timezone=Asia%2FKolkata'
    ].join('');

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const c = data.current;
    const { description, icon } = mapWeatherCode(c.weather_code ?? 0);

    const weather: WeatherData = {
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: c.relative_humidity_2m ?? 55,
      windSpeed: Math.round((c.wind_speed_10m ?? 3.5) * 10) / 10,
      cloudCover: c.cloud_cover ?? 40,
      feelsLike: Math.round((c.apparent_temperature ?? c.temperature_2m) * 10) / 10,
      pressure: Math.round(c.surface_pressure ?? 1013),
      irradiance: c.shortwave_radiation ?? undefined,
      description,
      icon,
      lastUpdated: new Date().toISOString(),
    };

    cachedWeather = weather;
    cacheTimestamp = now;
    return weather;
  } catch (error) {
    console.warn('[WeatherService] Open-Meteo fetch failed, using fallback:', error);

    // Return fallback with all required fields
    const fallback: WeatherData = {
      temperature: 28,
      humidity: 55,
      windSpeed: 3.5,
      cloudCover: 40,
      description: 'Fallback (API error)',
      icon: '02d',
      feelsLike: 30,
      pressure: 1013,
      irradiance: undefined,
      lastUpdated: new Date().toISOString(),
    };
    return fallback;
  }
};

/** Format weather as a prompt context string for Gemini. */
export const weatherToPromptContext = (weather: WeatherData): string => {
  const irr = weather.irradiance !== undefined ? `, Irradiance=${weather.irradiance}W/m²` : '';
  return `Current Weather: Temp=${weather.temperature}°C, FeelsLike=${weather.feelsLike}°C, Humidity=${weather.humidity}%, Wind=${weather.windSpeed}m/s, CloudCover=${weather.cloudCover}%, Pressure=${weather.pressure}hPa, Condition="${weather.description}"${irr}`;
};

/** Get the OpenWeatherMap icon URL (works with our mapped OWM-style icon codes). */
export const getWeatherIconUrl = (iconCode: string): string => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};
