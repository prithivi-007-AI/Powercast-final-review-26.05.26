import React, { useState, useEffect } from 'react';
import { LoadDataPoint, GeneratorUnit, AppState, HorizonUnit, ConfidenceLevel, PlantType } from './types';
import DataInputSection from './components/DataInputSection';
import Dashboard from './components/Dashboard';
import WeatherPanel from './components/WeatherPanel';
import ChatBot from './components/ChatBot';
import { applySavitzkyGolay, detectAnomalies } from './services/processing';
import { performAIForecast } from './services/geminiService';
import { fetchWeather } from './services/weatherService';

const DEFAULT_UNITS: GeneratorUnit[] = [
  { id: 'U1', name: 'Unit 1', capacity: 300, status: 'OFF', type: 'Solar',   efficiency: 22, fuelCost: 0    },
  { id: 'U2', name: 'Unit 2', capacity: 250, status: 'OFF', type: 'Wind',    efficiency: 40, fuelCost: 0    },
  { id: 'U3', name: 'Unit 3', capacity: 200, status: 'OFF', type: 'Thermal', efficiency: 38, fuelCost: 6500 },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    historicalData: [],
    forecastHorizonValue: 24,
    forecastHorizonUnit: 'hours',
    lookBackWindow: 48,
    units: DEFAULT_UNITS,
    plantType: 'Solar',
    isProcessing: false,
    results: null,
    weatherData: null,
    weatherLoading: false,
    weatherError: null,
    decisions: null,
    confidenceLevel: '90%',
  });

  // ── Generate synthetic historical data on mount ──
  useEffect(() => { generateSampleData(); }, []);

  // ── Weather: fetch on mount + hourly refresh ──
  useEffect(() => {
    const loadWeather = async () => {
      setState(prev => ({ ...prev, weatherLoading: true, weatherError: null }));
      try {
        const weather = await fetchWeather();
        setState(prev => ({ ...prev, weatherData: weather, weatherLoading: false }));
      } catch {
        setState(prev => ({
          ...prev,
          weatherLoading: false,
          weatherError: 'Weather data temporarily unavailable',
        }));
      }
    };

    loadWeather();
    const interval = setInterval(loadWeather, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const generateSampleData = () => {
    const sample: LoadDataPoint[] = [];
    const now = new Date();
    for (let i = 120; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3_600_000);
      const hour = time.getHours();
      let load = 150 + 80 * Math.sin((hour - 6) * Math.PI / 12);
      if (i === 40) load += 100;
      if (i === 80) load -= 60;
      sample.push({
        timestamp: time.toISOString().replace('T', ' ').substring(0, 16),
        load: parseFloat((load + Math.random() * 10).toFixed(2)),
      });
    }
    const smoothed = applySavitzkyGolay(sample.map(d => d.load));
    const anomalies = detectAnomalies(sample.map(d => d.load));
    setState(prev => ({
      ...prev,
      historicalData: sample.map((d, i) => ({ ...d, smoothed: smoothed[i], isAnomaly: anomalies[i] })),
    }));
  };

  const runAnalysis = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const { results, decisions } = await performAIForecast(
        state.historicalData,
        state.forecastHorizonValue,
        state.forecastHorizonUnit,
        state.lookBackWindow,
        state.units,
        state.weatherData,
        state.plantType,
      );
      setState(prev => ({ ...prev, results, decisions, isProcessing: false }));
    } catch (err) {
      console.error('[App] Analysis error:', err);
      alert('Analysis error. Please verify your Gemini API key and try again.');
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-main)] selection:bg-[var(--neu-shadow-dark)] selection:text-white">
      {/* ── Top Nav ── */}
      <nav className="neu-flat mb-8 py-4 px-8 flex justify-between items-center sticky top-4 z-50 mx-6 mt-4">
        <div className="flex items-center gap-4">
          <div className="neu-icon-box text-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-[var(--text-main)]">Powercast AI</h1>
            <p className="text-[9px] font-medium text-[var(--text-light)] mt-0.5">Multi-Plant Power Forecasting</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Plant type indicator in nav */}
          {state.plantType && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest"
              style={{ background: 'var(--bg-color)', boxShadow: 'inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light)', color: 'var(--accent)' }}
            >
              {state.plantType}
            </span>
          )}
          <button
            id="execute-forecast-btn"
            onClick={runAnalysis}
            disabled={state.isProcessing}
            className={`neu-btn-primary px-6 py-3 text-sm flex items-center gap-2 ${state.isProcessing ? 'opacity-70 cursor-wait' : ''}`}
          >
            {state.isProcessing && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {state.isProcessing ? 'Processing...' : '⚡ Execute Forecast'}
          </button>
        </div>
      </nav>

      {/* ── Main Layout ── */}
      <main className="max-w-[1600px] mx-auto p-6 lg:p-10 grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* ── Left sidebar ── */}
        <aside className="xl:col-span-1 space-y-6">
          <DataInputSection
            units={state.units}
            horizonValue={state.forecastHorizonValue}
            horizonUnit={state.forecastHorizonUnit}
            lookBack={state.lookBackWindow}
            onDataLoaded={(d) => {
              const smoothed = applySavitzkyGolay(d.map(p => p.load));
              const anomalies = detectAnomalies(d.map(p => p.load));
              setState(prev => ({
                ...prev,
                historicalData: d.map((p, i) => ({ ...p, smoothed: smoothed[i], isAnomaly: anomalies[i] })),
              }));
            }}
            setUnits={(u) => setState(prev => ({ ...prev, units: u }))}
            setHorizonValue={(v) => setState(prev => ({ ...prev, forecastHorizonValue: v }))}
            setHorizonUnit={(u) => setState(prev => ({ ...prev, forecastHorizonUnit: u }))}
            setLookBack={(l) => setState(prev => ({ ...prev, lookBackWindow: l }))}
            plantType={state.plantType}
            setPlantType={(t: PlantType) => setState(prev => ({ ...prev, plantType: t }))}
          />


          {/* Weather Panel */}
          <WeatherPanel
            weather={state.weatherData}
            loading={state.weatherLoading}
            error={state.weatherError}
          />

          {/* System Engine panel */}
          <div className="p-6 neu-flat relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[var(--accent)] rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700" />
            <h5 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-3">System Engine</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Analysis Engine</span>
                <span className="text-[var(--text-main)]">Gemini 2.0 Flash</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Anomaly Logic</span>
                <span className="neu-text-accent">Rolling Z-Score</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Weather Feed</span>
                <span className={state.weatherData ? 'text-emerald-500' : 'text-amber-500'}>
                  {state.weatherData ? 'Open-Meteo ✓' : 'Fallback'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Dispatch Engine</span>
                <span className="neu-text-accent">Renewable-First</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Plant Type</span>
                <span className="text-[var(--text-main)]">{state.plantType}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main dashboard area ── */}
        <section className="xl:col-span-3">
          <Dashboard
            historicalData={state.historicalData}
            results={state.results}
            units={state.units}
            horizonUnit={state.forecastHorizonUnit}
            decisions={state.decisions}
            weatherData={state.weatherData}
            confidenceLevel={state.confidenceLevel}
            onConfidenceLevelChange={(level: ConfidenceLevel) => setState(prev => ({ ...prev, confidenceLevel: level }))}
          />
        </section>
      </main>

      {/* ── AI Chatbot (floating, bottom-right) ── */}
      <ChatBot
        appState={{
          results: state.results,
          decisions: state.decisions,
          weatherData: state.weatherData,
          units: state.units,
          plantType: state.plantType,
        }}
      />
    </div>
  );
};

export default App;