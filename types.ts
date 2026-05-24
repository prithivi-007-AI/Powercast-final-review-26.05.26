export type HorizonUnit = 'hours' | 'days' | 'years';
export type ConfidenceLevel = '80%' | '90%' | '95%';
export type PlantType = 'Solar' | 'Wind' | 'Hydro' | 'Thermal' | 'Nuclear' | 'Hybrid';

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
  type: PlantType;
  efficiency: number;   // 0-100%
  fuelCost: number;     // ₹ per MWh
}

export interface WeatherData {
  temperature: number;     // °C
  humidity: number;        // %
  windSpeed: number;       // m/s
  cloudCover: number;      // %
  description: string;
  icon: string;
  feelsLike: number;       // °C
  pressure: number;        // hPa
  irradiance?: number;     // W/m² shortwave radiation (for solar forecasting)
  lastUpdated: string;     // ISO timestamp
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
  safetyMargin: number;
  priority: 'Routine' | 'Deferred' | 'Urgent';
}

export interface DecisionRecommendation {
  unitId: string;
  unitName: string;
  action: 'ON' | 'OFF' | 'STANDBY';
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  loadPercentage: number;
  confidence: number;             // 0-100% confidence score
  renewableContribution: number;  // % of demand covered by renewables
  estimatedSavings: number;       // ₹/hr savings vs baseline
}

export interface MaintenanceWindow {
  start: string;
  end: string;
  suggestedUnit: string;
  avgLoad: number;
  safetyMarginPercent: number;
  reason: string;
  operationalBenefit: string;
}

export interface DecisionResult {
  recommendations: DecisionRecommendation[];
  maintenanceOpportunities: MaintenanceWindow[];
  overallStatus: 'Normal' | 'Warning' | 'Critical';
  summary: string;
  renewablePercent: number;        // Overall renewable % of fleet
  totalEstimatedSavings: number;   // ₹/hr total savings
}

export interface ForecastResult {
  predictions: LoadDataPoint[];
  generationRequirement: number;
  recommendedUnits: string[];
  maintenanceWindows: MaintenanceSchedule[];
  explanation: string;
  upgradeAdvisory?: UpgradeRecommendation;
  projectedCostPerHour: number;
  systemEfficiency: number; // 0-100
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface AppState {
  historicalData: LoadDataPoint[];
  forecastHorizonValue: number;
  forecastHorizonUnit: HorizonUnit;
  lookBackWindow: number;
  units: GeneratorUnit[];
  plantType: PlantType;
  isProcessing: boolean;
  results: ForecastResult | null;
  weatherData: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;
  decisions: DecisionResult | null;
  confidenceLevel: ConfidenceLevel;
}