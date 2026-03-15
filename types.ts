
export type HorizonUnit = 'hours' | 'days' | 'years';

export interface LoadDataPoint {
  timestamp: string;
  load: number;
  smoothed?: number;
  predicted?: number;
  upperBound?: number;
  lowerBound?: number;
  isAnomaly?: boolean;
}

export interface GeneratorUnit {
  id: string;
  name: string;
  capacity: number;
  status: 'ON' | 'OFF';
}

export interface UpgradeRecommendation {
  additionalUnitsNeeded: number;
  targetTotalCapacity: number;
  reasoning: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface MaintenanceSchedule {
  start: string;
  end: string;
  suggestedUnit: string;
  avgLoadDuringWindow: number;
  safetyMargin: number; // Percent of capacity remaining during maintenance
  priority: 'Routine' | 'Deferred' | 'Urgent';
}

export interface ForecastResult {
  predictions: LoadDataPoint[];
  generationRequirement: number;
  recommendedUnits: string[];
  maintenanceWindows: MaintenanceSchedule[];
  explanation: string;
  upgradeAdvisory?: UpgradeRecommendation;
  // Economic Metrics
  projectedCostPerHour: number;
  systemEfficiency: number; // 0-100
}

export interface AppState {
  historicalData: LoadDataPoint[];
  forecastHorizonValue: number;
  forecastHorizonUnit: HorizonUnit;
  lookBackWindow: number; 
  units: GeneratorUnit[];
  isProcessing: boolean;
  results: ForecastResult | null;
}
