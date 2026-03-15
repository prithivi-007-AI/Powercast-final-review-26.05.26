
/**
 * Savitzky–Golay smoothing coefficients for window_length = 11, polynomial_order = 2.
 */
const SG_COEFFS_W11_P2 = [
  -0.0839, 0.0210, 0.1026, 0.1608, 0.1958, 0.2075, 0.1958, 0.1608, 0.1026, 0.0210, -0.0839
];

export const applySavitzkyGolay = (data: number[]): number[] => {
  const n = data.length;
  const windowSize = 11;
  const halfWindow = 5;
  const smoothed = [...data];
  if (n < windowSize) return smoothed;
  for (let i = halfWindow; i < n - halfWindow; i++) {
    let sum = 0;
    for (let j = -halfWindow; j <= halfWindow; j++) {
      sum += data[i + j] * SG_COEFFS_W11_P2[j + halfWindow];
    }
    smoothed[i] = Number(sum.toFixed(4));
  }
  return smoothed;
};

/**
 * Detects anomalies using a sliding window Z-score approach.
 */
export const detectAnomalies = (data: number[], threshold: number = 2.5): boolean[] => {
  const n = data.length;
  const anomalies = new Array(n).fill(false);
  const windowSize = 12; // 12-hour window for daily cycles

  for (let i = windowSize; i < n; i++) {
    const window = data.slice(i - windowSize, i);
    const mean = window.reduce((a, b) => a + b, 0) / windowSize;
    const stdDev = Math.sqrt(window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / windowSize);
    
    if (stdDev > 0) {
      const zScore = Math.abs(data[i] - mean) / stdDev;
      if (zScore > threshold) anomalies[i] = true;
    }
  }
  return anomalies;
};

export const normalize = (data: number[]): { normalized: number[]; min: number; max: number } => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  if (range === 0) return { normalized: data.map(() => 0.5), min, max };
  return { normalized: data.map(v => (v - min) / range), min, max };
};
