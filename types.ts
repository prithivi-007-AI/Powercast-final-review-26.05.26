
export type HorizonUnit = 'hours' | 'days' | 'years';
export type ConfidenceLevel = '80%' | '90%' | '95%';

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

export interface WeatherData {
  temperature: number;      // °C
  humidity: number;          // %
  windSpeed: number;         // m/s
  cloudCover: number;        // %
  description: string;       // e.g. "partly cloudy"
  icon: string;              // OpenWeatherMap icon code
  feelsLike: number;         // °C
  pressure: number;          // hPa
  lastUpdated: string;       // ISO timestamp
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

export interface DecisionRecommendation {
  unitId: string;
  unitName: string;
  action: 'ON' | 'OFF' | 'STANDBY';
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  loadPercentage: number;   // how much of capacity is needed
}

export interface MaintenanceWindow {
  start: string;
  end: string;
  suggestedUnit: string;
  avgLoad: number;
  safetyMarginPercent: number;
}

export interface DecisionResult {
  recommendations: DecisionRecommendation[];
  maintenanceOpportunities: MaintenanceWindow[];
  overallStatus: 'Normal' | 'Warning' | 'Critical';
  summary: string;
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
  weatherData: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;
  decisions: DecisionResult | null;
  confidenceLevel: ConfidenceLevel;
}
