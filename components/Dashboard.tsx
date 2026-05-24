
import React, { useMemo, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ReferenceLine
} from 'recharts';
import { LoadDataPoint, ForecastResult, GeneratorUnit, HorizonUnit, ConfidenceLevel, DecisionResult, WeatherData } from '../types';
import DecisionPanel from './DecisionPanel';
import ExportPanel from './ExportPanel';

// ============================================================================
// Dashboard — Main visualization area with chart, metrics, decisions & export
// Features:
//   - Prediction interval shaded bands (80%/90%/95% confidence)
//   - Interactive confidence level toggle
//   - Decision panel integration
//   - Export panel integration
// ============================================================================

interface Props {
  historicalData: LoadDataPoint[];
  results: ForecastResult | null;
  units: GeneratorUnit[];
  horizonUnit: HorizonUnit;
  decisions: DecisionResult | null;
  weatherData: WeatherData | null;
  confidenceLevel: ConfidenceLevel;
  onConfidenceLevelChange: (level: ConfidenceLevel) => void;
}

/**
 * Confidence level scaling factors relative to the 90% baseline from Gemini.
 * The AI returns 95% intervals; we scale accordingly:
 *   80% → narrower (z=1.28/1.645 ≈ 0.78)
 *   90% → baseline (z=1.645/1.645 = 1.0)  
 *   95% → widest (z=1.96/1.645 ≈ 1.19)
 */
const CONFIDENCE_SCALE: Record<ConfidenceLevel, number> = {
  '80%': 0.78,
  '90%': 1.0,
  '95%': 1.19,
};

const Dashboard: React.FC<Props> = ({
  historicalData, results, units, horizonUnit,
  decisions, weatherData, confidenceLevel, onConfidenceLevelChange
}) => {
  // Build combined chart data with scaled confidence intervals
  const { chartData, maxLoadValue } = useMemo(() => {
    let maxVal = 0;
    const combinedData: any[] = [];
    const scale = CONFIDENCE_SCALE[confidenceLevel];

    // 1. Add historical data points
    const historicalTail = historicalData.slice(-72); // Last 3 days if hourly
    historicalTail.forEach(d => {
      const val = Number(d.load) || 0;
      if (val > maxVal) maxVal = val;
      combinedData.push({
        time: d.timestamp,
        actual: val,
        forecast: null,
        upper: null,
        lower: null,
      });
    });

    // 2. Add prediction data points with scaled intervals
    if (results?.predictions && results.predictions.length > 0) {
      results.predictions.forEach((p, idx) => {
        const predicted = Number(p.predicted) || 0;
        const rawUpper = Number(p.upperBound) || predicted;
        const rawLower = Number(p.lowerBound) || predicted;
        
        // Scale upper/lower bounds from the 95% baseline
        const midpoint = predicted;
        const upperDelta = (rawUpper - midpoint) * scale;
        const lowerDelta = (midpoint - rawLower) * scale;
        
        const upper = midpoint + upperDelta;
        const lower = Math.max(0, midpoint - lowerDelta); // Can't go below 0
        
        if (upper > maxVal) maxVal = upper;

        // Bridge the first prediction to the last historical point
        if (idx === 0 && combinedData.length > 0) {
          const lastActual = combinedData[combinedData.length - 1];
          lastActual.forecast = lastActual.actual;
          lastActual.upper = lastActual.actual;
          lastActual.lower = lastActual.actual;
        }

        combinedData.push({
          time: p.timestamp,
          actual: null,
          forecast: predicted,
          upper: upper,
          lower: lower,
        });
      });
    }

    return { chartData: combinedData, maxLoadValue: maxVal };
  }, [historicalData, results, confidenceLevel]);

  const currentCapacity = units.reduce((acc, u) => acc + (Number(u.capacity) || 0), 0);
  const peakForecast = results?.predictions?.length
    ? Math.max(...results.predictions.map(p => Number(p.predicted) || 0))
    : 0;

  const useGW = maxLoadValue > 5000;
  const unitLabel = useGW ? 'GW' : 'MW';

  const formatYAxis = (val: any) => {
    const num = Number(val);
    return useGW ? (num / 1000).toFixed(1) : Math.round(num).toString();
  };

  const formatXAxis = (tick: string) => {
    const date = new Date(tick.replace(' ', 'T'));
    if (isNaN(date.getTime())) return tick;
    if (horizonUnit === 'hours') return `${date.getHours()}:00`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="space-y-6">
      {/* Financial and Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MetricBox
          label="Peak Demand"
          value={useGW ? (peakForecast / 1000).toFixed(2) : Math.round(peakForecast).toString()}
          unit={unitLabel}
          color="indigo"
        />
        <MetricBox
          label="System Cost"
          value={results ? `₹${(results.projectedCostPerHour / 1000).toFixed(1)}k` : '---'}
          unit="/hr"
          color="emerald"
        />
        <MetricBox
          label="Total Fleet"
          value={useGW ? (currentCapacity / 1000).toFixed(2) : currentCapacity.toString()}
          unit={unitLabel}
          color="slate"
        />
        <MetricBox
          label="Op. Efficiency"
          value={results ? `${Math.round(results.systemEfficiency)}%` : '---'}
          unit=""
          color="rose"
        />
      </div>

      {/* Main Chart with Prediction Intervals */}
      <div className="neu-flat p-6 relative">
        <div className="flex justify-between items-center mb-6 px-2 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-[var(--text-main)] tracking-tight">Load Projection Profile</h3>
            {/* Export buttons */}
            <ExportPanel forecast={results} decisions={decisions} weather={weatherData} units={units} historicalData={historicalData} />
          </div>
          <div className="flex items-center gap-4">
            {/* Confidence Level Toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg-color)] rounded-full p-1" style={{ boxShadow: 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)' }}>
              {(['80%', '90%', '95%'] as ConfidenceLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => onConfidenceLevelChange(level)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-wider transition-all duration-200 ${
                    confidenceLevel === level
                      ? 'bg-[var(--accent)] text-white shadow-md scale-105'
                      : 'text-[var(--text-light)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {level} CI
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--text-light)]"></div>
                <span className="text-[var(--text-light)]">Actual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--accent)]"></div>
                <span className="text-[var(--text-light)]">Forecast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[var(--accent)] opacity-20"></div>
                <span className="text-[var(--text-light)]">{confidenceLevel} Band</span>
              </div>
            </div>
          </div>
        </div>

        <div className="neu-pressed p-4 rounded-xl h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a3aab9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a3aab9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                minTickGap={40}
                tick={{ fill: '#a3aab9', fontWeight: 600 }}
              />
              <YAxis
                tickFormatter={formatYAxis}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tick={{ fill: '#a3aab9', fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-color)',
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '9px 9px 16px var(--neu-shadow-dark), -9px -9px 16px var(--neu-shadow-light)',
                  color: 'var(--text-main)'
                }}
                itemStyle={{ color: 'var(--text-main)' }}
                formatter={(val: any, name: string) => {
                  const num = Number(val).toFixed(1);
                  const labels: Record<string, string> = {
                    actual: 'Historical',
                    forecast: 'AI Predicted',
                    upper: `Upper (${confidenceLevel})`,
                    lower: `Lower (${confidenceLevel})`,
                  };
                  return [`${num} ${unitLabel}`, labels[name] || name];
                }}
              />

              {/* Confidence band — upper bound area (shaded) */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fillOpacity={1}
                fill="url(#colorConfidence)"
                connectNulls
                animationDuration={800}
              />
              {/* Lower bound area (masks the bottom of the band) */}
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fillOpacity={1}
                fill="var(--bg-color)"
                connectNulls
                animationDuration={800}
              />
              {/* Upper bound line (dashed) */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="#3B82F6"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                fillOpacity={0}
                fill="transparent"
                connectNulls
                animationDuration={800}
              />
              {/* Lower bound line (dashed) */}
              <Area
                type="monotone"
                dataKey="lower"
                stroke="#3B82F6"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                fillOpacity={0}
                fill="transparent"
                connectNulls
                animationDuration={800}
              />

              {/* Historical data line */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#a3aab9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorActual)"
                connectNulls
                animationDuration={1500}
              />
              {/* Forecast center line */}
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#3B82F6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorForecast)"
                connectNulls
                animationDuration={1500}
              />
              <ReferenceLine
                y={currentCapacity}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ position: 'top', value: 'Fleet Capacity', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategic Insight */}
      {results?.explanation && (
        <div className="neu-flat p-6 border-l-4 border-[var(--accent)]">
          <h4 className="text-[10px] font-black neu-text-accent uppercase tracking-widest mb-3">AI Intelligence Report</h4>
          <p className="text-sm font-medium leading-relaxed text-[var(--text-main)]">{results.explanation}</p>
        </div>
      )}

      {/* Decision Support & Fleet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Decision Panel */}
        <DecisionPanel decisions={decisions} />

        {/* Recommended Dispatch Fleet */}
        <div className="neu-flat p-6">
          <h4 className="text-xs font-black text-[var(--text-light)] uppercase tracking-widest mb-4">Recommended Dispatch Fleet</h4>
          <div className="flex flex-wrap gap-2">
            {units.map(u => {
              const isRecommended = results?.recommendedUnits.includes(u.name);
              // Match with decision recommendation
              const decision = decisions?.recommendations.find(r => r.unitName === u.name || r.unitId === u.id);
              return (
                <div
                  key={u.id}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isRecommended
                    ? 'neu-pressed text-emerald-600 border border-transparent'
                    : 'neu-flat text-[var(--text-light)] opacity-60'
                    }`}
                >
                  <span>{u.name} • {u.capacity}MW</span>
                  {decision && (
                    <span className={`ml-2 text-[9px] font-black uppercase ${
                      decision.action === 'ON' ? 'text-emerald-500' :
                      decision.action === 'STANDBY' ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      [{decision.action}]
                    </span>
                  )}
                </div>
              );
            })}
            {(!results) && <div className="text-xs text-slate-300 italic">Perform analysis to see dispatch recommendations</div>}
          </div>
        </div>
      </div>

      {/* Maintenance Windows */}
      <div className="neu-flat p-6">
        <h4 className="text-xs font-black text-[var(--text-light)] uppercase tracking-widest mb-4">AI Maintenance Strategy</h4>
        <div className="space-y-3">
          {results?.maintenanceWindows && results.maintenanceWindows.length > 0 ? (
            results.maintenanceWindows.map((win, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-700">{win.suggestedUnit}</span>
                  <span className="text-[10px] font-bold text-slate-400">{win.start} — {win.end}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Safety Margin</span>
                    <span className={`text-[11px] font-black ${win.safetyMargin < 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {win.safetyMargin.toFixed(1)}%
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${win.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' :
                    win.priority === 'Deferred' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                    {win.priority}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-300 italic">No maintenance windows identified in current horizon</div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, unit, color }: any) => {
  const themes: any = {
    indigo: 'text-[#6366f1]',
    emerald: 'text-[#10b981]',
    rose: 'text-[#f43f5e]',
    slate: 'text-[#64748b]'
  };
  return (
    <div className={`p-6 rounded-2xl neu-flat flex flex-col justify-center`}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-60 text-[var(--text-main)]">{label}</p>
      <p className={`text-2xl font-black ${themes[color]}`}>{value}<span className="text-[10px] font-bold ml-1 opacity-50 text-[var(--text-main)]">{unit}</span></p>
    </div>
  );
};

export default Dashboard;
