
import React from 'react';
import { WeatherData } from '../types';
import { getWeatherIconUrl } from '../services/weatherService';

// ============================================================================
// Weather Panel — Displays current weather conditions in the sidebar.
// Premium neumorphic card with weather icon, temperature, and details.
// ============================================================================

interface Props {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
}

const WeatherPanel: React.FC<Props> = ({ weather, loading, error }) => {
  if (loading) {
    return (
      <div className="neu-flat p-6 relative overflow-hidden">
        <h5 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-4">
          Weather Intelligence
        </h5>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin"></div>
          <span className="ml-3 text-xs text-[var(--text-light)] font-bold">Fetching weather data...</span>
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="neu-flat p-6 relative overflow-hidden">
        <h5 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-4">
          Weather Intelligence
        </h5>
        <p className="text-xs text-[var(--text-light)] italic">
          {error || 'Weather data unavailable'}
        </p>
      </div>
    );
  }

  return (
    <div className="neu-flat p-6 relative overflow-hidden group">
      {/* Accent glow */}
      <div className="absolute -right-6 -top-6 w-28 h-28 bg-[#10b981] rounded-full opacity-[0.07] group-hover:scale-150 transition-transform duration-700"></div>

      <h5 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-4">
        Weather Intelligence
      </h5>

      {/* Main weather display */}
      <div className="flex items-center gap-3 mb-4">
        <div className="neu-pressed p-1 rounded-xl flex-shrink-0">
          <img
            src={getWeatherIconUrl(weather.icon)}
            alt={weather.description}
            className="w-12 h-12"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div>
          <div className="text-2xl font-black text-[var(--text-main)] leading-none">
            {weather.temperature}°
            <span className="text-xs font-bold text-[var(--text-light)] ml-1">C</span>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-light)] capitalize mt-0.5">
            {weather.description}
          </p>
        </div>
      </div>

      {/* Weather metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <WeatherMetric icon="💧" label="Humidity" value={`${weather.humidity}%`} />
        <WeatherMetric icon="💨" label="Wind" value={`${weather.windSpeed} m/s`} />
        <WeatherMetric icon="☁️" label="Clouds" value={`${weather.cloudCover}%`} />
        <WeatherMetric icon="🌡️" label="Feels Like" value={`${weather.feelsLike}°C`} />
      </div>

      {/* Pressure bar */}
      <div className="mt-3 pt-3 border-t border-gray-200/50">
        <div className="flex justify-between items-center text-[10px] font-bold">
          <span className="text-[var(--text-light)]">Pressure</span>
          <span className="text-[var(--text-main)]">{weather.pressure} hPa</span>
        </div>
      </div>

      {/* Last updated */}
      <div className="mt-2 text-[8px] font-bold text-[var(--text-light)] uppercase tracking-widest opacity-60">
        Updated {new Date(weather.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};

/** Individual weather metric cell */
const WeatherMetric = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="neu-pressed p-2.5 rounded-xl text-center">
    <span className="text-sm">{icon}</span>
    <p className="text-[8px] font-black text-[var(--text-light)] uppercase tracking-widest mt-0.5">{label}</p>
    <p className="text-xs font-black text-[var(--text-main)]">{value}</p>
  </div>
);

export default WeatherPanel;
