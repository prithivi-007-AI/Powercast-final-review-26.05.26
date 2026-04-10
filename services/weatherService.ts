import { WeatherData } from '../types';

/**
 * Fetch current weather data from the FastAPI backend proxy.
 */
export const fetchWeather = async (): Promise<WeatherData> => {
  try {
    const response = await fetch('/api/weather');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data as WeatherData;
  } catch (error) {
    console.error('[WeatherService] API fetch failed, using fallback:', error);
    // Return fallback on any error
    return {
      temperature: 28,
      humidity: 55,
      wind_speed: 3.5,
      cloud_cover: 40,
      description: 'Fallback (API error)',
      icon: '02d',
      feels_like: 30,
      pressure: 1013,
    };
  }
};

/**
 * Format weather data as a context string for the prompt (if still needed anywhere).
 */
export const weatherToPromptContext = (weather: WeatherData): string => {
  return `Current Weather: Temp=${weather.temperature}°C, Humidity=${weather.humidity}%, Wind=${weather.wind_speed}m/s, CloudCover=${weather.cloud_cover}%, Pressure=${weather.pressure}hPa, Condition="${weather.description}"`;
};

/**
 * Get the OpenWeatherMap icon URL.
 */
export const getWeatherIconUrl = (iconCode: string): string => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};
