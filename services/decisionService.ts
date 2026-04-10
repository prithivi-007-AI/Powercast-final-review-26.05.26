
import { ForecastResult, GeneratorUnit, DecisionResult, DecisionRecommendation, MaintenanceWindow } from '../types';

// ============================================================================
// Decision Support Service — Generator ON/OFF Logic
// Analyzes forecast data against generator fleet capacity to produce
// intelligent recommendations for generator dispatch and maintenance.
// ============================================================================

/** Threshold percentages for decision classification */
const THRESHOLDS = {
  OVERLOAD_RATIO: 0.85,         // Unit at 85%+ of capacity → High priority ON
  COMFORTABLE_RATIO: 0.50,      // Unit below 50% utilization → consider OFF
  STANDBY_RATIO: 0.65,          // Between 50-65% → Standby
  LOW_LOAD_PERCENT: 40,         // Below 40% avg → maintenance opportunity
  RESERVE_MARGIN: 0.15,         // Keep 15% reserve above predicted peak
};

/**
 * Generate decision recommendations from forecast results and generator fleet.
 * 
 * Logic:
 * 1. Calculate the peak forecasted load
 * 2. Determine required capacity = peakLoad × (1 + reserve margin)
 * 3. Sort generators by capacity (largest first for efficiency)
 * 4. Assign ON/OFF/STANDBY based on cumulative capacity vs requirement
 * 5. Detect low-load periods for maintenance
 */
export const generateDecisions = (
  forecast: ForecastResult,
  units: GeneratorUnit[]
): DecisionResult => {
  if (!forecast?.predictions?.length || !units?.length) {
    return {
      recommendations: [],
      maintenanceOpportunities: [],
      overallStatus: 'Normal',
      summary: 'No forecast data available for decision analysis.',
    };
  }

  const predictions = forecast.predictions;

  // Calculate key metrics
  const predictedLoads = predictions.map(p => Number(p.predicted) || 0);
  const peakLoad = Math.max(...predictedLoads);
  const avgLoad = predictedLoads.reduce((a, b) => a + b, 0) / predictedLoads.length;
  const minLoad = Math.min(...predictedLoads);
  const totalCapacity = units.reduce((acc, u) => acc + (Number(u.capacity) || 0), 0);
  const requiredCapacity = peakLoad * (1 + THRESHOLDS.RESERVE_MARGIN);

  // Sort units by capacity descending (dispatch largest first for efficiency)
  const sortedUnits = [...units].sort((a, b) => b.capacity - a.capacity);

  // Build recommendations
  const recommendations: DecisionRecommendation[] = [];
  let accumulatedCapacity = 0;

  for (const unit of sortedUnits) {
    const unitCapacity = Number(unit.capacity) || 0;

    if (accumulatedCapacity >= requiredCapacity) {
      // Already have enough capacity — turn off remaining
      recommendations.push({
        unitId: unit.id,
        unitName: unit.name,
        action: 'OFF',
        reason: `Sufficient capacity already dispatched (${Math.round(accumulatedCapacity)} MW). Unit not needed for current load profile.`,
        priority: 'Low',
        loadPercentage: 0,
      });
    } else if (accumulatedCapacity + unitCapacity <= requiredCapacity * THRESHOLDS.COMFORTABLE_RATIO) {
      // Critical — must turn on
      accumulatedCapacity += unitCapacity;
      const utilization = Math.round((peakLoad / accumulatedCapacity) * 100);
      recommendations.push({
        unitId: unit.id,
        unitName: unit.name,
        action: 'ON',
        reason: `Essential for load coverage. Peak demand ${Math.round(peakLoad)} MW requires this unit at ~${Math.min(utilization, 100)}% utilization.`,
        priority: 'High',
        loadPercentage: Math.min(utilization, 100),
      });
    } else if (accumulatedCapacity < requiredCapacity) {
      // Needed but not critical — standby or on depends on how close to threshold
      accumulatedCapacity += unitCapacity;
      const remainingNeeded = requiredCapacity - (accumulatedCapacity - unitCapacity);
      const unitUtilization = Math.round((remainingNeeded / unitCapacity) * 100);

      if (unitUtilization > THRESHOLDS.STANDBY_RATIO * 100) {
        recommendations.push({
          unitId: unit.id,
          unitName: unit.name,
          action: 'ON',
          reason: `Required for reserve margin. Covers ${Math.round(remainingNeeded)} MW of remaining demand.`,
          priority: 'Medium',
          loadPercentage: Math.min(unitUtilization, 100),
        });
      } else {
        recommendations.push({
          unitId: unit.id,
          unitName: unit.name,
          action: 'STANDBY',
          reason: `Partial load coverage needed (${unitUtilization}% utilization). Keep on standby for demand ramp-up.`,
          priority: 'Medium',
          loadPercentage: unitUtilization,
        });
      }
    }
  }

  // Detect maintenance opportunities during low-load periods
  const maintenanceOpps = detectMaintenanceWindows(predictions, totalCapacity);

  // Determine overall system status
  let overallStatus: DecisionResult['overallStatus'] = 'Normal';
  const capacityRatio = peakLoad / totalCapacity;
  if (capacityRatio > THRESHOLDS.OVERLOAD_RATIO) {
    overallStatus = 'Critical';
  } else if (capacityRatio > THRESHOLDS.STANDBY_RATIO) {
    overallStatus = 'Warning';
  }

  // Build summary
  const onCount = recommendations.filter(r => r.action === 'ON').length;
  const offCount = recommendations.filter(r => r.action === 'OFF').length;
  const standbyCount = recommendations.filter(r => r.action === 'STANDBY').length;

  const summary = `Peak demand: ${Math.round(peakLoad)} MW / ${Math.round(totalCapacity)} MW capacity (${Math.round(capacityRatio * 100)}%). ` +
    `Recommendation: ${onCount} ON, ${standbyCount} STANDBY, ${offCount} OFF. ` +
    `${maintenanceOpps.length} maintenance window${maintenanceOpps.length !== 1 ? 's' : ''} identified.`;

  return {
    recommendations,
    maintenanceOpportunities: maintenanceOpps,
    overallStatus,
    summary,
  };
};

/**
 * Detect periods of low load suitable for scheduled maintenance.
 */
function detectMaintenanceWindows(
  predictions: { timestamp: string; predicted?: number }[],
  totalCapacity: number
): MaintenanceWindow[] {
  const windows: MaintenanceWindow[] = [];
  const threshold = totalCapacity * (THRESHOLDS.LOW_LOAD_PERCENT / 100);
  
  let windowStart: string | null = null;
  let windowLoads: number[] = [];

  for (let i = 0; i < predictions.length; i++) {
    const load = Number(predictions[i].predicted) || 0;

    if (load < threshold) {
      if (!windowStart) {
        windowStart = predictions[i].timestamp;
      }
      windowLoads.push(load);
    } else {
      // Close current window if at least 3 consecutive low-load periods
      if (windowStart && windowLoads.length >= 3) {
        const avgLoad = windowLoads.reduce((a, b) => a + b, 0) / windowLoads.length;
        const safetyMargin = ((totalCapacity - avgLoad) / totalCapacity) * 100;
        windows.push({
          start: windowStart,
          end: predictions[i - 1].timestamp,
          suggestedUnit: 'Lowest priority unit',
          avgLoad: Math.round(avgLoad),
          safetyMarginPercent: Math.round(safetyMargin),
        });
      }
      windowStart = null;
      windowLoads = [];
    }
  }

  // Close final window
  if (windowStart && windowLoads.length >= 3) {
    const avgLoad = windowLoads.reduce((a, b) => a + b, 0) / windowLoads.length;
    const safetyMargin = ((totalCapacity - avgLoad) / totalCapacity) * 100;
    windows.push({
      start: windowStart,
      end: predictions[predictions.length - 1].timestamp,
      suggestedUnit: 'Lowest priority unit',
      avgLoad: Math.round(avgLoad),
      safetyMarginPercent: Math.round(safetyMargin),
    });
  }

  return windows;
}
