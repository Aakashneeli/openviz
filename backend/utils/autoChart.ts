// ============================================
// Auto-Chart Heuristic
// Intelligently determines optimal chart type
// ============================================

import type { ShelfPlacement, MarkType, FieldType } from '../types';

/**
 * Determine the best chart type based on current encodings
 */
export function determineChartType(encodings: ShelfPlacement[]): MarkType {
    const xField = encodings.find((e) => e.channel === 'x');
    const yField = encodings.find((e) => e.channel === 'y');
    const colorField = encodings.find((e) => e.channel === 'color');

    // No encodings - return default
    if (!xField && !yField) {
        return 'bar';
    }

    // Only one field
    if (!xField || !yField) {
        const singleField = xField || yField;
        if (singleField && isQuantitative(singleField.field.type)) {
            return 'bar'; // Histogram
        }
        return 'bar'; // Count by category
    }

    const xType = xField.field.type;
    const yType = yField.field.type;

    // 1 Date/Temporal + 1 Number -> Line Chart
    if (isTemporal(xType) && isQuantitative(yType)) {
        return 'line';
    }
    if (isTemporal(yType) && isQuantitative(xType)) {
        return 'line';
    }

    // 2 Numbers -> Scatter Plot
    if (isQuantitative(xType) && isQuantitative(yType)) {
        return 'point';
    }

    // 1 Category + 1 Number -> Bar Chart
    if (isNominalOrOrdinal(xType) && isQuantitative(yType)) {
        return 'bar';
    }
    if (isQuantitative(xType) && isNominalOrOrdinal(yType)) {
        return 'bar';
    }

    // 2 Categories -> Heatmap (rect)
    if (isNominalOrOrdinal(xType) && isNominalOrOrdinal(yType)) {
        // If there's a color encoding with a quantitative field, use heatmap
        if (colorField && isQuantitative(colorField.field.type)) {
            return 'rect';
        }
        return 'bar';
    }

    // Default to bar
    return 'bar';
}

/**
 * Get smart suggestions for chart types based on encodings
 */
export function getChartSuggestions(
    encodings: ShelfPlacement[]
): Array<{ mark: MarkType; score: number; reason: string }> {
    const suggestions: Array<{ mark: MarkType; score: number; reason: string }> = [];

    const xField = encodings.find((e) => e.channel === 'x');
    const yField = encodings.find((e) => e.channel === 'y');

    if (!xField && !yField) {
        return [
            { mark: 'bar', score: 1, reason: 'Default chart type' },
        ];
    }

    const xType = xField?.field.type;
    const yType = yField?.field.type;

    // Temporal X + Quantitative Y
    if (xType && yType && isTemporal(xType) && isQuantitative(yType)) {
        suggestions.push(
            { mark: 'line', score: 0.9, reason: 'Best for showing trends over time' },
            { mark: 'area', score: 0.7, reason: 'Good for cumulative values over time' },
            { mark: 'bar', score: 0.5, reason: 'Can show discrete time periods' },
        );
    }

    // Two quantitative fields
    if (xType && yType && isQuantitative(xType) && isQuantitative(yType)) {
        suggestions.push(
            { mark: 'point', score: 0.9, reason: 'Best for showing correlations' },
            { mark: 'line', score: 0.4, reason: 'If data is ordered' },
        );
    }

    // Nominal X + Quantitative Y
    if (xType && yType && isNominalOrOrdinal(xType) && isQuantitative(yType)) {
        suggestions.push(
            { mark: 'bar', score: 0.9, reason: 'Best for comparing categories' },
            { mark: 'point', score: 0.5, reason: 'Alternative for category comparison' },
        );
    }

    // Add bar as fallback if no suggestions
    if (suggestions.length === 0) {
        suggestions.push({ mark: 'bar', score: 0.5, reason: 'Default chart type' });
    }

    return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Suggest aggregation for a field based on its type
 */
export function suggestAggregation(
    fieldType: FieldType,
    channel: 'x' | 'y' | 'color' | 'size'
): 'sum' | 'mean' | 'count' | undefined {
    if (fieldType === 'quantitative') {
        if (channel === 'y' || channel === 'size') {
            return 'sum'; // Default to sum for measures on Y axis
        }
        return 'mean';
    }

    if (fieldType === 'nominal' || fieldType === 'ordinal') {
        return 'count';
    }

    return undefined;
}

/**
 * Check if binning is recommended for a field
 */
export function shouldBin(
    fieldType: FieldType,
    uniqueCount: number | undefined,
    channel: 'x' | 'y'
): boolean {
    // Bin quantitative fields with high cardinality on X axis
    if (fieldType === 'quantitative' && channel === 'x') {
        return (uniqueCount ?? 0) > 20;
    }
    return false;
}

// Helper functions
function isQuantitative(type: FieldType): boolean {
    return type === 'quantitative';
}

function isTemporal(type: FieldType): boolean {
    return type === 'temporal';
}

function isNominalOrOrdinal(type: FieldType): boolean {
    return type === 'nominal' || type === 'ordinal';
}

/**
 * Get description for a mark type
 */
export function getMarkDescription(mark: MarkType): string {
    const descriptions: Record<MarkType, string> = {
        bar: 'Bar Chart - Compare values across categories',
        line: 'Line Chart - Show trends over time or continuous data',
        point: 'Scatter Plot - Show relationships between two measures',
        area: 'Area Chart - Show cumulative values over time',
        arc: 'Pie/Donut Chart - Show parts of a whole',
        rect: 'Heatmap - Show patterns in two-dimensional data',
        rule: 'Rule - Show reference lines or ranges',
        text: 'Text - Display values as text labels',
        tick: 'Tick Plot - Show distribution of values',
        auto: 'Auto - Let OpenViz choose the best chart type',
    };
    return descriptions[mark];
}
