// ============================================
// Forecast Service
// Time-series forecasting with multiple methods
// ============================================

import type { DataRecord, ForecastPoint, ForecastResult } from '../types';

/**
 * Linear regression forecast
 */
function linearForecast(
    xValues: number[],
    yValues: number[],
    periods: number
): { points: ForecastPoint[]; slope: number; intercept: number } {
    const n = xValues.length;
    if (n === 0) return { points: [], slope: 0, intercept: 0 };

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((s, x, i) => s + x * yValues[i], 0);
    const sumX2 = xValues.reduce((s, x) => s + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const points: ForecastPoint[] = [];
    const lastX = xValues[n - 1];
    const step = n > 1 ? (xValues[n - 1] - xValues[0]) / (n - 1) : 1;

    for (let i = 1; i <= periods; i++) {
        const x = lastX + step * i;
        const y = slope * x + intercept;
        points.push({ x, y });
    }

    return { points, slope, intercept };
}

/**
 * Simple Exponential Smoothing
 */
function exponentialSmoothing(
    values: number[],
    alpha: number,
    periods: number
): ForecastPoint[] {
    if (values.length === 0) return [];

    // Initialize with first value
    let smoothed = values[0];

    // Apply smoothing to historical data
    for (let i = 1; i < values.length; i++) {
        smoothed = alpha * values[i] + (1 - alpha) * smoothed;
    }

    // Forecast: flat line at last smoothed value
    const points: ForecastPoint[] = [];
    for (let i = 1; i <= periods; i++) {
        points.push({ x: values.length + i, y: smoothed });
    }

    return points;
}

/**
 * Holt's Linear Trend Method (double exponential smoothing)
 */
function holtsLinearTrend(
    values: number[],
    alpha: number,
    beta: number,
    periods: number
): ForecastPoint[] {
    if (values.length < 2) return exponentialSmoothing(values, alpha, periods);

    // Initialize
    let level = values[0];
    let trend = values[1] - values[0];

    // Apply smoothing
    for (let i = 1; i < values.length; i++) {
        const newLevel = alpha * values[i] + (1 - alpha) * (level + trend);
        const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
        level = newLevel;
        trend = newTrend;
    }

    // Forecast
    const points: ForecastPoint[] = [];
    for (let i = 1; i <= periods; i++) {
        points.push({ x: values.length + i, y: level + trend * i });
    }

    return points;
}

/**
 * Calculate confidence intervals from residuals
 */
function addConfidenceIntervals(
    actuals: number[],
    predicted: number[],
    forecasts: ForecastPoint[]
): ForecastPoint[] {
    // Calculate residual standard deviation
    const n = Math.min(actuals.length, predicted.length);
    if (n < 2) return forecasts;

    let sumSquaredResiduals = 0;
    for (let i = 0; i < n; i++) {
        sumSquaredResiduals += Math.pow(actuals[i] - predicted[i], 2);
    }
    const residualStdDev = Math.sqrt(sumSquaredResiduals / (n - 1));

    // Add intervals (widening with distance)
    return forecasts.map((p, i) => {
        const spread = residualStdDev * 1.96 * Math.sqrt(1 + (i + 1) / n);
        return {
            ...p,
            lower: p.y - spread,
            upper: p.y + spread,
        };
    });
}

/**
 * Detect if data has significant trend
 */
function hasTrend(values: number[]): boolean {
    if (values.length < 5) return false;

    const n = values.length;
    const xValues = values.map((_, i) => i);
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((s, x, i) => s + x * values[i], 0);
    const sumX2 = xValues.reduce((s, x) => s + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const mean = sumY / n;

    // Significant if slope is > 5% of mean per step
    return Math.abs(slope) > Math.abs(mean) * 0.05;
}

/**
 * Select best forecasting method based on data characteristics
 */
function selectBestMethod(values: number[]): 'linear' | 'exponential_smoothing' | 'holts_linear' {
    if (values.length < 5) return 'linear';

    if (hasTrend(values)) {
        return 'holts_linear';
    }

    return 'exponential_smoothing';
}

/**
 * Main forecast entry point
 */
export function generateForecast(
    data: DataRecord[],
    temporalField: string,
    metricField: string,
    periods: number = 6
): ForecastResult {
    // Extract and sort values
    const sorted = [...data].sort((a, b) => {
        const aVal = a[temporalField];
        const bVal = b[temporalField];
        if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal);
        return Number(aVal) - Number(bVal);
    });

    const yValues = sorted.map(d => Number(d[metricField]) || 0);
    const xLabels = sorted.map(d => String(d[temporalField]));
    const xNumeric = yValues.map((_, i) => i);

    const method = selectBestMethod(yValues);
    let forecastPoints: ForecastPoint[];

    switch (method) {
        case 'linear': {
            const result = linearForecast(xNumeric, yValues, periods);
            forecastPoints = result.points;

            // Add predicted values for confidence intervals
            const predicted = xNumeric.map(x => result.slope * x + result.intercept);
            forecastPoints = addConfidenceIntervals(yValues, predicted, forecastPoints);
            break;
        }
        case 'exponential_smoothing': {
            forecastPoints = exponentialSmoothing(yValues, 0.3, periods);
            // Simple confidence: use stddev of actuals
            const mean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
            const stdDev = Math.sqrt(yValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / yValues.length);
            forecastPoints = forecastPoints.map((p, i) => ({
                ...p,
                lower: p.y - stdDev * 1.96 * Math.sqrt(1 + (i + 1) / yValues.length),
                upper: p.y + stdDev * 1.96 * Math.sqrt(1 + (i + 1) / yValues.length),
            }));
            break;
        }
        case 'holts_linear': {
            forecastPoints = holtsLinearTrend(yValues, 0.3, 0.1, periods);
            // Use linear regression predicted values for residuals
            const linResult = linearForecast(xNumeric, yValues, 0);
            const predicted = xNumeric.map(x => linResult.slope * x + linResult.intercept);
            forecastPoints = addConfidenceIntervals(yValues, predicted, forecastPoints);
            break;
        }
    }

    // Generate forecast labels (extend from last known label)
    const lastLabel = xLabels[xLabels.length - 1] || '';
    forecastPoints = forecastPoints.map((p, i) => ({
        ...p,
        x: `${lastLabel} +${i + 1}`,
    }));

    return {
        method,
        periods,
        points: forecastPoints,
        temporalField,
        metricField,
    };
}
