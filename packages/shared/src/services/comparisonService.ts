// ============================================
// Comparison Service
// Executes group comparisons on data
// ============================================

import type {
    DataRecord,
    FieldInfo,
    ComparisonSpec,
    ComparisonResult,
    AggregateFunction,
} from '../types';

/**
 * Aggregate values from a subset of data
 */
function aggregateValues(data: DataRecord[], field: string, agg: AggregateFunction): number {
    const values = data.map(d => Number(d[field]) || 0);
    if (values.length === 0) return 0;

    switch (agg) {
        case 'sum':
            return values.reduce((a, b) => a + b, 0);
        case 'mean':
            return values.reduce((a, b) => a + b, 0) / values.length;
        case 'count':
            return values.length;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        case 'median': {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        case 'distinct':
            return new Set(data.map(d => d[field])).size;
        default:
            return values.reduce((a, b) => a + b, 0);
    }
}

/**
 * Execute a comparison between two groups
 */
export function executeComparison(data: DataRecord[], spec: ComparisonSpec): ComparisonResult {
    const { groupField, groupValues, metricField, aggregate } = spec;
    const [valueA, valueB] = groupValues;

    const groupAData = data.filter(d => String(d[groupField]) === valueA);
    const groupBData = data.filter(d => String(d[groupField]) === valueB);

    const aggA = aggregateValues(groupAData, metricField, aggregate);
    const aggB = aggregateValues(groupBData, metricField, aggregate);

    const difference = aggB - aggA;
    const percentChange = aggA !== 0 ? ((aggB - aggA) / Math.abs(aggA)) * 100 : 0;

    const direction = percentChange > 0 ? 'higher' : percentChange < 0 ? 'lower' : 'the same';
    const summary = `${valueB} is ${Math.abs(percentChange).toFixed(1)}% ${direction} than ${valueA} for ${aggregate} of ${metricField} (${aggA.toFixed(1)} vs ${aggB.toFixed(1)})`;

    return {
        spec,
        groupA: { label: valueA, value: aggA },
        groupB: { label: valueB, value: aggB },
        difference,
        percentChange,
        summary,
    };
}

/**
 * Build chart config for comparison visualization (returns ECharts-compatible series data)
 */
export function buildComparisonChartData(
    result: ComparisonResult,
    _fields: FieldInfo[]
): {
    categories: string[];
    values: number[];
    colors: string[];
} {
    return {
        categories: [result.groupA.label, result.groupB.label],
        values: [result.groupA.value, result.groupB.value],
        colors: ['#3b82f6', '#f59e0b'],
    };
}
