// ============================================
// Chart Recommendation Service
// Analyzes field pairs to suggest best charts
// ============================================

import type {
    FieldInfo,
    DataRecord,
    ChartRecommendation,
    MarkType,
} from '../types';
import { generateId } from '../utils/id';

/**
 * Score type compatibility between two fields for visualization
 */
function scoreTypeCompatibility(xField: FieldInfo, yField: FieldInfo): number {
    const xType = xField.type;
    const yType = yField.type;

    // Best combos
    if ((xType === 'nominal' || xType === 'ordinal') && yType === 'quantitative') return 1.0;
    if (xType === 'temporal' && yType === 'quantitative') return 1.0;
    if (xType === 'quantitative' && yType === 'quantitative') return 0.8;
    // Decent combos
    if ((xType === 'nominal' || xType === 'ordinal') && (yType === 'nominal' || yType === 'ordinal')) return 0.4;
    if (xType === 'quantitative' && (yType === 'nominal' || yType === 'ordinal')) return 0.3;

    return 0.2;
}

/**
 * Score cardinality suitability (too many categories is bad for bar charts, etc.)
 */
function scoreCardinality(xField: FieldInfo, _yField: FieldInfo): number {
    const uniqueCount = xField.stats.uniqueCount ?? 0;

    if (xField.type === 'nominal' || xField.type === 'ordinal') {
        if (uniqueCount >= 3 && uniqueCount <= 15) return 1.0;
        if (uniqueCount > 15 && uniqueCount <= 30) return 0.6;
        if (uniqueCount > 30) return 0.3;
        if (uniqueCount < 3) return 0.5;
    }

    if (xField.type === 'temporal') return 0.9;
    if (xField.type === 'quantitative') return 0.7;

    return 0.5;
}

/**
 * Score variance of the Y field (higher variance = more interesting chart)
 */
function scoreVariance(yField: FieldInfo): number {
    if (yField.type !== 'quantitative') return 0.5;

    const { mean, stdDev, min, max } = yField.stats;
    if (mean === undefined || stdDev === undefined || min === undefined || max === undefined) return 0.5;
    if (mean === 0) return 0.5;

    const cv = stdDev / Math.abs(mean); // coefficient of variation
    if (cv > 0.5) return 1.0;
    if (cv > 0.3) return 0.8;
    if (cv > 0.1) return 0.6;
    return 0.4;
}

/**
 * Simple correlation score between two quantitative fields
 */
function scoreCorrelation(xField: FieldInfo, yField: FieldInfo, data: DataRecord[]): number {
    if (xField.type !== 'quantitative' || yField.type !== 'quantitative') return 0.5;

    const n = Math.min(data.length, 200);
    const xValues = data.slice(0, n).map(d => Number(d[xField.name]) || 0);
    const yValues = data.slice(0, n).map(d => Number(d[yField.name]) || 0);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        const dx = xValues[i] - xMean;
        const dy = yValues[i] - yMean;
        sumXY += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
    }

    const denom = Math.sqrt(sumX2 * sumY2);
    if (denom === 0) return 0.5;

    const r = Math.abs(sumXY / denom);
    return r; // Higher correlation = more interesting
}

/**
 * Select the best mark type for a field pair
 * Now returns more variety including pie, area, funnel, treemap etc.
 */
function selectMarkType(xField: FieldInfo, yField: FieldInfo): MarkType {
    const xType = xField.type;
    const yType = yField.type;
    const xCardinality = xField.stats.uniqueCount ?? 0;

    // Temporal + Quantitative → Line or Area chart
    if (xType === 'temporal' && yType === 'quantitative') {
        return xCardinality > 30 ? 'area' : 'line';
    }

    // Two Quantitative fields → Scatter plot
    if (xType === 'quantitative' && yType === 'quantitative') {
        return 'point';
    }

    // Low cardinality categorical + quantitative → Multiple options
    if ((xType === 'nominal' || xType === 'ordinal') && yType === 'quantitative') {
        if (xCardinality <= 5) {
            return 'arc'; // Pie chart for very few categories
        }
        if (xCardinality <= 8) {
            return 'funnel'; // Funnel for few categories
        }
        if (xCardinality <= 12) {
            return 'bar'; // Bar chart for moderate categories
        }
        return 'treemap'; // Treemap for many categories
    }

    // Quantitative on X, categorical on Y → Horizontal bar-like
    if (xType === 'quantitative' && (yType === 'nominal' || yType === 'ordinal')) {
        const yCardinality = yField.stats.uniqueCount ?? 0;
        if (yCardinality <= 5) {
            return 'radar'; // Radar for few dimensions
        }
        return 'bar';
    }

    // Default fallback
    return 'bar';
}

/**
 * Truncate a field name for display (max 20 chars)
 */
function truncateName(name: string, maxLen: number = 18): string {
    return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

/**
 * Generate a human-readable reason for the recommendation
 */
function generateReason(xField: FieldInfo, yField: FieldInfo, mark: MarkType): string {
    const markLabels: Record<string, string> = {
        bar: 'Bar chart',
        line: 'Line chart',
        point: 'Scatter plot',
        area: 'Area chart',
        arc: 'Pie chart',
        funnel: 'Funnel chart',
        treemap: 'Treemap',
        radar: 'Radar chart',
        gauge: 'Gauge',
        heatmap: 'Heatmap',
    };

    const chartLabel = markLabels[mark] || 'Chart';
    const xName = truncateName(xField.name);
    const yName = truncateName(yField.name);

    if (mark === 'line') return `${yName} trend over ${xName}`;
    if (mark === 'area') return `${yName} trend with fill`;
    if (mark === 'point') return `Correlation: ${xName} vs ${yName}`;
    if (mark === 'bar') return `${yName} by ${xName}`;
    if (mark === 'arc') return `${yName} distribution by ${xName}`;
    if (mark === 'funnel') return `${yName} breakdown`;
    if (mark === 'treemap') return `${yName} proportions by ${xName}`;
    if (mark === 'radar') return `Multi-dim ${yName} analysis`;

    return `${chartLabel}: ${yName} by ${xName}`;
}

/**
 * Score a chart candidate with weighted criteria
 */
function scoreChartCandidate(
    xField: FieldInfo,
    yField: FieldInfo,
    data: DataRecord[]
): number {
    const typeScore = scoreTypeCompatibility(xField, yField) * 0.25;
    const cardScore = scoreCardinality(xField, yField) * 0.30;
    const varScore = scoreVariance(yField) * 0.20;
    const corrScore = scoreCorrelation(xField, yField, data) * 0.15;
    const uniqueBonus = (xField.id !== yField.id ? 0.1 : 0); // Penalize same field

    return typeScore + cardScore + varScore + corrScore + uniqueBonus;
}

/**
 * Generate top chart recommendations for a dataset
 * Prioritizes diversity in chart types for better recommendations
 */
export function generateRecommendations(
    fields: FieldInfo[],
    data: DataRecord[],
    limit: number = 5
): ChartRecommendation[] {
    const candidates: ChartRecommendation[] = [];

    for (const xField of fields) {
        for (const yField of fields) {
            if (xField.id === yField.id) continue;

            // Only consider valid pairings (x should be categorical/temporal, y quantitative for most charts)
            const score = scoreChartCandidate(xField, yField, data);
            if (score < 0.3) continue;

            const mark = selectMarkType(xField, yField);
            const reason = generateReason(xField, yField, mark);

            candidates.push({
                id: generateId(),
                mark,
                xField: xField.name,
                yField: yField.name,
                score,
                reason,
            });
        }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Selection with diversity: prefer different chart types
    const seen = new Set<string>();
    const usedMarks = new Set<MarkType>();
    const diverseResults: ChartRecommendation[] = [];
    const sameTypeQueue: ChartRecommendation[] = [];

    for (const c of candidates) {
        const key = `${c.mark}-${c.xField}-${c.yField}`;
        const reverseKey = `${c.mark}-${c.yField}-${c.xField}`;

        if (seen.has(key) || seen.has(reverseKey)) continue;
        seen.add(key);

        // Prioritize charts with new mark types for diversity
        if (!usedMarks.has(c.mark)) {
            usedMarks.add(c.mark);
            diverseResults.push(c);
        } else {
            sameTypeQueue.push(c);
        }

        if (diverseResults.length >= limit) break;
    }

    // Fill remaining slots with same-type charts if needed
    while (diverseResults.length < limit && sameTypeQueue.length > 0) {
        diverseResults.push(sameTypeQueue.shift()!);
    }

    return diverseResults;
}
