import { ForecastResult, WeatherData, DecisionResult, GeneratorUnit, LoadDataPoint } from '../types';

/**
 * Trigger a browser file download from a Blob.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const getApiPayload = (
  forecast: ForecastResult,
  units: GeneratorUnit[],
  historicalData: LoadDataPoint[]
) => {
  const lastPoint = historicalData.length > 0 ? (historicalData[historicalData.length - 1].smoothed ?? 200) : 200;
  return {
    horizon: forecast.predictions.length,
    last_historical_load: lastPoint,
    units: units.map(u => ({
      id: u.id,
      name: u.name,
      capacity: u.capacity,
      status: u.status
    }))
  };
};

export const exportCSV = async (
  forecast: ForecastResult,
  decisions: DecisionResult | null,
  weather: WeatherData | null,
  units: GeneratorUnit[],
  historicalData: LoadDataPoint[]
): Promise<void> => {
  const payload = getApiPayload(forecast, units, historicalData);
  
  const response = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSV from backend API');
  }

  const blob = await response.blob();
  const timestamp = new Date().toISOString().slice(0, 10);
  // Backend returns xlsx
  downloadBlob(blob, `PowerCast_Forecast_${timestamp}.xlsx`);
};

export const exportPDF = async (
  forecast: ForecastResult,
  decisions: DecisionResult | null,
  weather: WeatherData | null,
  units: GeneratorUnit[],
  historicalData: LoadDataPoint[]
): Promise<void> => {
  const payload = getApiPayload(forecast, units, historicalData);

  const response = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to fetch PDF from backend API');
  }

  const blob = await response.blob();
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `PowerCast_Report_${timestamp}.pdf`);
};
