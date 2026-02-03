/**
 * Annotation Service
 *
 * Provides statistical analysis for chart annotations including:
 * - Outlier detection using Z-score method
 * - Max/min value identification
 * - Trend line calculations
 */

export interface Annotation {
  type: 'outlier' | 'max' | 'min' | 'trend';
  dataIndex: number;
  value: number;
  label: string;
  coord?: [number | string, number]; // For ECharts positioning
}

/**
 * Calculate mean (average) of numeric array
 */
function calculateMean(data: number[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, val) => acc + val, 0);
  return sum / data.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(data: number[], mean: number): number {
  if (data.length === 0) return 0;
  const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Detect outliers using Z-score method
 * Points with |z-score| > threshold are considered outliers
 *
 * @param data - Array of numeric values
 * @param threshold - Z-score threshold (default: 2 = ~95% confidence)
 * @param maxOutliers - Maximum number of outliers to return
 * @returns Array of outlier annotations
 */
export function detectOutliers(
  data: number[],
  threshold: number = 2,
  maxOutliers: number = 3
): Annotation[] {
  if (data.length < 4) return []; // Need at least 4 points for meaningful outlier detection

  const mean = calculateMean(data);
  const stdDev = calculateStdDev(data, mean);

  if (stdDev === 0) return []; // All values are the same

  const outliers = data
    .map((val, idx) => {
      const z = (val - mean) / stdDev;
      return { value: val, index: idx, z };
    })
    .filter(({ z }) => Math.abs(z) > threshold)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)) // Sort by most extreme
    .slice(0, maxOutliers)
    .map(({ value, index, z }) => ({
      type: 'outlier' as const,
      dataIndex: index,
      value,
      label: `Outlier: ${value.toFixed(2)} (${z.toFixed(1)}σ)`,
    }));

  return outliers;
}

/**
 * Detect extreme values (max and min)
 *
 * @param data - Array of numeric values
 * @param fieldName - Name of the field for labeling
 * @param xAxisData - Optional X-axis labels for positioning
 * @returns Array with max and min annotations
 */
export function detectExtremes(
  data: number[],
  fieldName: string,
  xAxisData?: (string | number)[]
): Annotation[] {
  if (data.length === 0) return [];

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);

  const maxIdx = data.indexOf(maxValue);
  const minIdx = data.indexOf(minValue);

  const annotations: Annotation[] = [];

  // Add max annotation
  if (maxIdx !== -1) {
    annotations.push({
      type: 'max',
      dataIndex: maxIdx,
      value: maxValue,
      label: `Peak: ${maxValue.toLocaleString()}`,
      coord: xAxisData ? [xAxisData[maxIdx], maxValue] : undefined,
    });
  }

  // Add min annotation (only if different from max)
  if (minIdx !== -1 && minValue !== maxValue) {
    annotations.push({
      type: 'min',
      dataIndex: minIdx,
      value: minValue,
      label: `Low: ${minValue.toLocaleString()}`,
      coord: xAxisData ? [xAxisData[minIdx], minValue] : undefined,
    });
  }

  return annotations;
}

/**
 * Generate all annotations for a dataset
 * Combines outliers and extremes, limited to prevent clutter
 *
 * @param data - Array of numeric values
 * @param fieldName - Name of the field being analyzed
 * @param options - Configuration options
 * @returns Array of annotations (max 5 by default)
 */
export function generateAnnotations(
  data: number[],
  fieldName: string,
  options: {
    includeOutliers?: boolean;
    includeExtremes?: boolean;
    maxAnnotations?: number;
    outlierThreshold?: number;
    xAxisData?: (string | number)[];
  } = {}
): Annotation[] {
  const {
    includeOutliers = true,
    includeExtremes = true,
    maxAnnotations = 5,
    outlierThreshold = 2,
    xAxisData,
  } = options;

  const annotations: Annotation[] = [];

  // Add extremes (max/min)
  if (includeExtremes) {
    const extremes = detectExtremes(data, fieldName, xAxisData);
    annotations.push(...extremes);
  }

  // Add outliers (excluding already marked extremes)
  if (includeOutliers && data.length >= 4) {
    const extremeIndices = annotations.map(a => a.dataIndex);
    const outliers = detectOutliers(data, outlierThreshold, 3)
      .filter(o => !extremeIndices.includes(o.dataIndex)); // Don't duplicate extremes
    annotations.push(...outliers);
  }

  // Limit total annotations to prevent clutter
  return annotations.slice(0, maxAnnotations);
}

/**
 * Calculate simple linear regression for trend line
 * Returns slope and intercept for y = mx + b
 */
export function calculateTrendLine(
  xData: number[],
  yData: number[]
): { slope: number; intercept: number; r2: number } | null {
  if (xData.length !== yData.length || xData.length < 2) return null;

  const n = xData.length;
  const sumX = xData.reduce((a, b) => a + b, 0);
  const sumY = yData.reduce((a, b) => a + b, 0);
  const sumXY = xData.reduce((sum, x, i) => sum + x * yData[i], 0);
  const sumX2 = xData.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = yData.reduce((sum, y) => sum + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R² (coefficient of determination)
  const meanY = sumY / n;
  const ssTotal = yData.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const ssResidual = yData.reduce((sum, y, i) => {
    const predicted = slope * xData[i] + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  const r2 = 1 - (ssResidual / ssTotal);

  return { slope, intercept, r2 };
}
