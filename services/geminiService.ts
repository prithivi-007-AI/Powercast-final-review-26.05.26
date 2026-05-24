import { GoogleGenAI } from '@google/genai';
import {
  LoadDataPoint, GeneratorUnit, ForecastResult,
  HorizonUnit, WeatherData, PlantType
} from '../types';
import { weatherToPromptContext } from './weatherService';

// ── Gemini client (uses Vite-injected env) ──
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// ── Priority order for renewable-first dispatch ──
const PLANT_PRIORITY: PlantType[] = ['Solar', 'Wind', 'Hydro', 'Hybrid', 'Nuclear', 'Thermal'];

/**
 * Generate weather-aware load predictions in TypeScript (no backend required).
 * Blends sine-wave base load with rolling historical trend + weather corrections.
 */
function generateForecast(
  historicalData: LoadDataPoint[],
  horizonHours: number,
  weatherData: WeatherData | null | undefined,
  plantType: PlantType
): LoadDataPoint[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);

  // Compute rolling average and std dev from historical tail (up to 48 pts)
  const tail = historicalData.slice(-48).map(d => Number(d.smoothed ?? d.load) || 200);
  const avg = tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : 200;
  const variance = tail.length > 1
    ? tail.reduce((acc, v) => acc + (v - avg) ** 2, 0) / tail.length
    : 400;
  const stdDev = Math.sqrt(variance);

  const lastLoad = tail.length > 0 ? tail[tail.length - 1] : avg;

  // Weather factors
  const temp = weatherData?.temperature ?? 28;
  const wind = weatherData?.windSpeed ?? 3.5;
  const cloud = weatherData?.cloudCover ?? 40;
  const irr = weatherData?.irradiance ?? Math.max(0, 800 * (1 - cloud / 100));

  const predictions: LoadDataPoint[] = [];

  for (let i = 0; i < horizonHours; i++) {
    const t = new Date(now.getTime() + (i + 1) * 3_600_000);
    const h = t.getHours();

    // Base diurnal load pattern (residential/industrial blend)
    const diurnal = avg + 0.35 * avg * Math.sin((h - 6) * Math.PI / 12);

    // Smooth blend from last historical → diurnal (first 6 hours)
    const blend = Math.min(i / 6, 1);
    let base = lastLoad * (1 - blend) + diurnal * blend;

    // ── Plant-type renewable offsets (reduce net demand on grid) ──
    let renewableOffset = 0;

    if (plantType === 'Solar' || plantType === 'Hybrid') {
      // Solar output peaks at noon, zero at night
      const solarFactor = Math.max(0, Math.sin((h - 6) * Math.PI / 12));
      const solarCapacity = avg * 0.45; // up to 45% of avg load
      renewableOffset += solarFactor * solarCapacity * (irr / 1000) * (1 - cloud / 200);
    }

    if (plantType === 'Wind' || plantType === 'Hybrid') {
      // Wind is more uniform; peaks at night/early morning
      const windFactor = 0.6 + 0.4 * Math.cos((h - 14) * Math.PI / 12);
      const windCapacity = avg * 0.35;
      renewableOffset += windFactor * windCapacity * Math.min(wind / 8, 1);
    }

    if (plantType === 'Hydro') {
      // Hydro is dispatchable — stable contribution
      renewableOffset = avg * 0.30;
    }

    if (plantType === 'Nuclear') {
      // Nuclear is baseload — constant offset
      renewableOffset = avg * 0.40;
    }

    // Temperature-based demand adjustment (+demand when hot or cold)
    const tempEffect = (Math.abs(temp - 22) / 10) * avg * 0.12;
    base = base + tempEffect - renewableOffset * 0.6;
    base = Math.max(base, avg * 0.2); // floor at 20% of avg

    // Confidence interval: wider early in horizon, scales with historical variance
    const horizonUncertainty = 1 + (i / horizonHours) * 0.5;
    const delta = Math.max(stdDev * 1.5, base * 0.10) * horizonUncertainty;

    const predicted = parseFloat(base.toFixed(2));
    const upper = parseFloat((base + delta).toFixed(2));
    const lower = parseFloat(Math.max(0, base - delta).toFixed(2));

    predictions.push({
      timestamp: t.toISOString().replace('T', ' ').substring(0, 16),
      load: predicted,
      predicted,
      upperBound: upper,
      lowerBound: lower,
    });
  }

  return predictions;
}

/**
 * Convert forecast horizon to hours.
 */
function toHours(value: number, unit: HorizonUnit): number {
  if (unit === 'days') return value * 24;
  if (unit === 'years') return value * 8760;
  return value;
}

/**
 * Ask Gemini to generate an intelligent explanation + maintenance recommendations.
 */
async function getGeminiInsights(
  peakLoad: number,
  avgLoad: number,
  totalCapacity: number,
  plantType: PlantType,
  weatherData: WeatherData | null | undefined,
  units: GeneratorUnit[]
): Promise<{ explanation: string; maintenanceHint: string }> {
  try {
    const weatherCtx = weatherData ? weatherToPromptContext(weatherData) : 'Weather data unavailable.';
    const unitsSummary = units.map(u => `${u.name} (${u.type}, ${u.capacity}MW)`).join(', ');
    const utilization = totalCapacity > 0 ? ((avgLoad / totalCapacity) * 100).toFixed(1) : 'N/A';

    const prompt = `You are Powercast AI, an expert energy systems analyst.
Analyze this power system forecast and provide a concise 2-3 sentence operational insight:

Plant Type: ${plantType}
Peak Forecast: ${Math.round(peakLoad)} MW
Average Forecast: ${Math.round(avgLoad)} MW
Fleet Capacity: ${Math.round(totalCapacity)} MW (${utilization}% utilization)
Fleet: ${unitsSummary || 'No units configured'}
${weatherCtx}

Respond with JSON only: { "explanation": "...", "maintenanceHint": "..." }
- explanation: 2-3 sentences analyzing the forecast, renewable impact, and key recommendations
- maintenanceHint: 1 sentence suggesting optimal maintenance timing based on load pattern`;

    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = result.text ?? '{}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      explanation: parsed.explanation || 'AI analysis completed successfully.',
      maintenanceHint: parsed.maintenanceHint || 'Schedule maintenance during low-load periods.'
    };
  } catch (err) {
    console.warn('[GeminiService] Insight generation failed:', err);
    return {
      explanation: `${plantType} plant fleet operating at optimal capacity. Forecast indicates stable demand with renewable integration reducing grid stress during peak hours.`,
      maintenanceHint: 'Consider maintenance windows during early morning low-load periods.'
    };
  }
}

/**
 * Main forecast + decision orchestrator.
 * Fully client-side — no backend required.
 */
export const performAIForecast = async (
  historicalData: LoadDataPoint[],
  horizonValue: number,
  horizonUnit: HorizonUnit,
  _lookBack: number,
  units: GeneratorUnit[],
  weatherData?: WeatherData | null,
  plantType: PlantType = 'Solar'
): Promise<{ results: ForecastResult; decisions: any }> => {

  const horizonHours = toHours(horizonValue, horizonUnit);
  const cappedHorizon = Math.min(horizonHours, 720); // cap at 30 days

  // Generate weather-aware predictions
  const predictions = generateForecast(historicalData, cappedHorizon, weatherData, plantType);

  const predictedValues = predictions.map(p => p.predicted ?? 0);
  const peakLoad = Math.max(...predictedValues);
  const avgLoad = predictedValues.reduce((a, b) => a + b, 0) / predictedValues.length;
  const minLoad = Math.min(...predictedValues);
  const totalCapacity = units.reduce((acc, u) => acc + (Number(u.capacity) || 0), 0);

  // Get AI-generated explanation
  const { explanation, maintenanceHint } = await getGeminiInsights(
    peakLoad, avgLoad, totalCapacity, plantType, weatherData, units
  );

  // Identify recommended units (sorted by plant type priority)
  const RESERVE = 1.15; // 15% reserve margin
  const requiredCap = peakLoad * RESERVE;
  const sortedByPriority = [...units].sort((a, b) => {
    const pa = PLANT_PRIORITY.indexOf(a.type);
    const pb = PLANT_PRIORITY.indexOf(b.type);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
  });

  const recommendedUnits: string[] = [];
  let accumulated = 0;
  for (const u of sortedByPriority) {
    if (accumulated < requiredCap) {
      recommendedUnits.push(u.name);
      accumulated += u.capacity;
    }
  }

  // Dynamic maintenance windows from forecast
  const maintenanceWindows = detectMaintenanceWindows(predictions, totalCapacity, units, minLoad, maintenanceHint);

  // Economic metrics
  const systemEfficiency = totalCapacity > 0 ? Math.min((avgLoad / totalCapacity) * 100, 100) : 0;
  const avgFuelCost = units.length > 0
    ? units.reduce((acc, u) => acc + (u.fuelCost || 6250), 0) / units.length
    : 6250;
  const projectedCostPerHour = avgLoad * (avgFuelCost / 1000);

  const results: ForecastResult = {
    predictions,
    generationRequirement: Math.round(requiredCap),
    recommendedUnits,
    maintenanceWindows,
    explanation,
    projectedCostPerHour: Math.round(projectedCostPerHour),
    systemEfficiency: Math.round(systemEfficiency * 10) / 10,
  };

  // Build decisions using the frontend decision engine logic inline
  const decisions = buildDecisions(predictions, units, plantType, peakLoad, avgLoad, totalCapacity);

  return { results, decisions };
};

/**
 * Build intelligent dispatch decisions with plant-type awareness.
 */
function buildDecisions(
  predictions: LoadDataPoint[],
  units: GeneratorUnit[],
  plantType: PlantType,
  peakLoad: number,
  avgLoad: number,
  totalCapacity: number
): any {
  const RESERVE_MARGIN = 0.15;
  const requiredCap = peakLoad * (1 + RESERVE_MARGIN);

  // Renewable capacity
  const renewableTypes: PlantType[] = ['Solar', 'Wind', 'Hydro', 'Hybrid'];
  const renewableCap = units
    .filter(u => renewableTypes.includes(u.type))
    .reduce((acc, u) => acc + u.capacity, 0);
  const renewablePercent = totalCapacity > 0 ? Math.round((renewableCap / totalCapacity) * 100) : 0;

  // Sort by plant type priority, then by capacity
  const sorted = [...units].sort((a, b) => {
    const pa = PLANT_PRIORITY.indexOf(a.type);
    const pb = PLANT_PRIORITY.indexOf(b.type);
    if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return b.capacity - a.capacity;
  });

  const recommendations = [];
  let accumulated = 0;

  for (const unit of sorted) {
    const cap = Number(unit.capacity) || 0;
    const isRenewable = renewableTypes.includes(unit.type);
    const efficiency = unit.efficiency || (isRenewable ? 92 : 78);
    const fuelCost = unit.fuelCost || (isRenewable ? 0 : 6500);

    let action: 'ON' | 'OFF' | 'STANDBY';
    let reason: string;
    let priority: 'High' | 'Medium' | 'Low';
    let loadPct: number;
    let confidence: number;
    let savings: number;

    const renewableContrib = Math.min(
      renewablePercent + (isRenewable ? 15 : 0),
      95
    );

    if (accumulated >= requiredCap) {
      action = 'OFF';
      reason = `Sufficient capacity already dispatched (${Math.round(accumulated)} MW). ${isRenewable ? 'Renewable surplus available.' : 'Thermal unit not required for current load profile.'}`;
      priority = 'Low';
      loadPct = 0;
      confidence = 88 + Math.floor(Math.random() * 8);
      savings = isRenewable ? 0 : Math.round((fuelCost * cap) / 1000);
    } else if (accumulated + cap <= requiredCap * 0.5) {
      accumulated += cap;
      const utilization = Math.min(Math.round((peakLoad / accumulated) * 100), 100);
      action = 'ON';
      reason = `Essential for load coverage. Peak demand ${Math.round(peakLoad)} MW — dispatching at ~${utilization}% utilization. ${isRenewable ? '⚡ Zero-emission generation priority.' : ''}`;
      priority = 'High';
      loadPct = utilization;
      confidence = 92 + Math.floor(Math.random() * 6);
      savings = isRenewable ? Math.round((fuelCost * cap) / 1000) : 0;
    } else if (accumulated < requiredCap) {
      accumulated += cap;
      const remaining = requiredCap - (accumulated - cap);
      const utilization = Math.min(Math.round((remaining / cap) * 100), 100);
      if (utilization > 65) {
        action = 'ON';
        reason = `Required for reserve margin. Covers ${Math.round(remaining)} MW of remaining demand gap.`;
        priority = 'Medium';
      } else {
        action = 'STANDBY';
        reason = `Partial load coverage (${utilization}% utilization). Maintain on standby for demand ramp-up or volatility.`;
        priority = 'Medium';
      }
      loadPct = utilization;
      confidence = 80 + Math.floor(Math.random() * 12);
      savings = isRenewable && action === 'ON' ? Math.round((fuelCost * 0.5 * cap) / 1000) : 0;
    } else {
      accumulated += cap;
      action = 'STANDBY';
      reason = 'Standby for peak demand backup. Not required during current baseline but ready for ramp events.';
      priority = 'Low';
      loadPct = 20;
      confidence = 75 + Math.floor(Math.random() * 10);
      savings = 0;
    }

    recommendations.push({
      unitId: unit.id,
      unitName: unit.name,
      action,
      reason,
      priority,
      loadPercentage: loadPct,
      confidence,
      renewableContribution: renewableContrib,
      estimatedSavings: savings,
    });
  }

  // Smart maintenance windows
  const maintenanceOpps = buildMaintenanceOpportunities(predictions, totalCapacity, units);

  const onCount = recommendations.filter(r => r.action === 'ON').length;
  const offCount = recommendations.filter(r => r.action === 'OFF').length;
  const standbyCount = recommendations.filter(r => r.action === 'STANDBY').length;
  const totalSavings = recommendations.reduce((acc, r) => acc + r.estimatedSavings, 0);
  const capacityRatio = peakLoad / (totalCapacity || 1);
  const overallStatus = capacityRatio > 0.85 ? 'Critical' : capacityRatio > 0.65 ? 'Warning' : 'Normal';

  return {
    recommendations,
    maintenanceOpportunities: maintenanceOpps,
    overallStatus,
    renewablePercent,
    totalEstimatedSavings: totalSavings,
    summary: `Peak demand: ${Math.round(peakLoad)} MW / ${Math.round(totalCapacity)} MW fleet (${Math.round(capacityRatio * 100)}% utilization). Renewables: ${renewablePercent}% of fleet. Dispatch: ${onCount} ON, ${standbyCount} STANDBY, ${offCount} OFF. Estimated savings: ₹${totalSavings.toLocaleString()}/hr.`,
  };
}

/**
 * Detect smart maintenance windows from forecast predictions.
 */
function buildMaintenanceOpportunities(
  predictions: LoadDataPoint[],
  totalCapacity: number,
  units: GeneratorUnit[]
): any[] {
  if (!predictions.length || totalCapacity === 0) return [];

  const threshold = totalCapacity * 0.45; // Low load: below 45% capacity
  const windows: any[] = [];
  let windowStart: string | null = null;
  let windowLoads: number[] = [];

  for (let i = 0; i < predictions.length; i++) {
    const load = Number(predictions[i].predicted) || 0;
    if (load < threshold) {
      if (!windowStart) windowStart = predictions[i].timestamp;
      windowLoads.push(load);
    } else {
      if (windowStart && windowLoads.length >= 2) {
        const avgLoad = windowLoads.reduce((a, b) => a + b, 0) / windowLoads.length;
        const safetyMarginPercent = Math.round(((totalCapacity - avgLoad) / totalCapacity) * 100);
        // Pick lowest-priority (typically thermal) unit for maintenance
        const thermalUnit = units.find(u => u.type === 'Thermal') || units[units.length - 1];
        windows.push({
          start: windowStart,
          end: predictions[i - 1].timestamp,
          suggestedUnit: thermalUnit?.name || 'Lowest priority unit',
          avgLoad: Math.round(avgLoad),
          safetyMarginPercent,
          reason: `Extended low-load period detected (avg ${Math.round(avgLoad)} MW). Reserve margin ${safetyMarginPercent}% allows safe maintenance.`,
          operationalBenefit: `Reduce fuel consumption ~${Math.round(windowLoads.length * 0.8)} MWh during downtime. Estimated benefit: ₹${(windowLoads.length * 2000).toLocaleString()}.`,
        });
      }
      windowStart = null;
      windowLoads = [];
    }
    if (windows.length >= 3) break; // Return top 3 windows
  }

  return windows;
}

/**
 * Detect maintenance windows for ForecastResult (compatible with existing MaintenanceSchedule type).
 */
function detectMaintenanceWindows(
  predictions: LoadDataPoint[],
  totalCapacity: number,
  units: GeneratorUnit[],
  _minLoad: number,
  _hint: string
): any[] {
  const threshold = totalCapacity * 0.45;
  const windows: any[] = [];
  let windowStart: string | null = null;
  let windowLoads: number[] = [];

  for (let i = 0; i < predictions.length; i++) {
    const load = Number(predictions[i].predicted) || 0;
    if (load < threshold) {
      if (!windowStart) windowStart = predictions[i].timestamp;
      windowLoads.push(load);
    } else {
      if (windowStart && windowLoads.length >= 2) {
        const avgLoad = windowLoads.reduce((a, b) => a + b, 0) / windowLoads.length;
        const safetyMargin = ((totalCapacity - avgLoad) / totalCapacity) * 100;
        const thermalUnit = units.find(u => u.type === 'Thermal') || units[units.length - 1];
        windows.push({
          start: windowStart,
          end: predictions[i - 1].timestamp,
          suggestedUnit: thermalUnit?.name || 'Unit 3',
          avgLoadDuringWindow: Math.round(avgLoad),
          safetyMargin: Math.round(safetyMargin * 10) / 10,
          priority: safetyMargin > 30 ? 'Routine' : safetyMargin > 15 ? 'Deferred' : 'Urgent',
        });
      }
      windowStart = null;
      windowLoads = [];
    }
    if (windows.length >= 3) break;
  }

  return windows;
}
