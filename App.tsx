
import React, { useState, useEffect } from 'react';
import { LoadDataPoint, GeneratorUnit, AppState, HorizonUnit } from './types';
import DataInputSection from './components/DataInputSection';
import Dashboard from './components/Dashboard';
import { applySavitzkyGolay, detectAnomalies } from './services/processing';
import { performAIForecast } from './services/geminiService';

const DEFAULT_UNITS: GeneratorUnit[] = [
  { id: 'U1', name: 'Unit 1', capacity: 300, status: 'OFF' },
  { id: 'U2', name: 'Unit 2', capacity: 250, status: 'OFF' },
  { id: 'U3', name: 'Unit 3', capacity: 200, status: 'OFF' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    historicalData: [],
    forecastHorizonValue: 24,
    forecastHorizonUnit: 'hours',
    lookBackWindow: 48,
    units: DEFAULT_UNITS,
    isProcessing: false,
    results: null
  });

  useEffect(() => { generateSampleData(); }, []);

  const generateSampleData = () => {
    const sample: LoadDataPoint[] = [];
    const now = new Date();
    for (let i = 120; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      const hour = time.getHours();
      let load = 150 + 80 * Math.sin((hour - 6) * Math.PI / 12);

      // Inject some synthetic anomalies
      if (i === 40) load += 100; // Spike
      if (i === 80) load -= 60;  // Drop

      sample.push({
        timestamp: time.toISOString().replace('T', ' ').substring(0, 16),
        load: parseFloat((load + (Math.random() * 10)).toFixed(2))
      });
    }

    const smoothed = applySavitzkyGolay(sample.map(d => d.load));
    const anomalies = detectAnomalies(sample.map(d => d.load));

    setState(prev => ({
      ...prev,
      historicalData: sample.map((d, i) => ({
        ...d,
        smoothed: smoothed[i],
        isAnomaly: anomalies[i]
      }))
    }));
  };

  const runAnalysis = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const results = await performAIForecast(
        state.historicalData,
        state.forecastHorizonValue,
        state.forecastHorizonUnit,
        state.lookBackWindow,
        state.units
      );
      setState(prev => ({ ...prev, results, isProcessing: false }));
    } catch (err) {
      alert("Analysis error. Please verify input data.");
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-main)] selection:bg-[var(--neu-shadow-dark)] selection:text-white">
      <nav className="neu-flat mb-8 py-4 px-8 flex justify-between items-center sticky top-4 z-50 mx-6 mt-4">
        <div className="flex items-center gap-4">
          <div className="neu-icon-box text-2xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none text-[var(--text-main)]">PowerCast <span className="neu-text-accent">Pro</span></h1>
            <p className="text-[9px] font-bold text-[var(--text-light)] uppercase tracking-widest mt-1">Smart Infrastructure Analytics</p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={state.isProcessing}
          className={`neu-btn px-8 py-3 text-sm flex items-center gap-2 ${state.isProcessing ? 'opacity-70 cursor-wait' : 'hover:scale-105 active:scale-95'
            }`}
        >
          {state.isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
          {state.isProcessing ? 'PROCESSING...' : 'EXECUTE FORECAST'}
        </button>
      </nav>

      <main className="max-w-[1600px] mx-auto p-6 lg:p-10 grid grid-cols-1 xl:grid-cols-4 gap-8">
        <aside className="xl:col-span-1">
          <DataInputSection
            {...state}
            onDataLoaded={(d) => {
              const smoothed = applySavitzkyGolay(d.map(p => p.load));
              const anomalies = detectAnomalies(d.map(p => p.load));
              setState(prev => ({ ...prev, historicalData: d.map((p, i) => ({ ...p, smoothed: smoothed[i], isAnomaly: anomalies[i] })) }));
            }}
            setUnits={(u) => setState(prev => ({ ...prev, units: u }))}
            setHorizonValue={(v) => setState(prev => ({ ...prev, forecastHorizonValue: v }))}
            setHorizonUnit={(u) => setState(prev => ({ ...prev, forecastHorizonUnit: u }))}
            setLookBack={(l) => setState(prev => ({ ...prev, lookBackWindow: l }))}
          />
          <div className="mt-6 p-6 neu-flat relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[var(--accent)] rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700"></div>
            <h5 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-3">System Engine</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Analysis Engine</span>
                <span className="text-[var(--text-main)]">Gemini Flash (Stable)</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-[var(--text-light)]">Anomaly Logic</span>
                <span className="neu-text-accent">Rolling Z-Score</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="xl:col-span-3">
          <Dashboard
            historicalData={state.historicalData}
            results={state.results}
            units={state.units}
            horizonUnit={state.forecastHorizonUnit}
          />
        </section>
      </main>

      <style>{`
        /* Custom overrides if needed */
      `}</style>
    </div>
  );
};

export default App;
