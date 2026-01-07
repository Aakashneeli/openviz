// ============================================
// Schema Inference Utility
// Detects column types and generates statistics
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { parse, isValid } from 'date-fns';
import type {
    FieldInfo,
    FieldType,
    FieldStats,
    DataRecord
} from '../types';

// Date formats to try for temporal detection
const DATE_FORMATS = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'dd/MM/yyyy',
    'yyyy/MM/dd',
    'yyyy-MM-dd HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
    'yyyy-MM-dd\'T\'HH:mm:ss',
    'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'',
];

// Sample size for type inference
const DEFAULT_SAMPLE_SIZE = 1000;

// Threshold for considering a numeric field as ordinal
const ORDINAL_THRESHOLD = 10;

/**
 * Infer schema from raw data
 * Scans sample rows to detect types and calculate statistics
 */
export function inferSchema(
    data: DataRecord[],
    sampleSize: number = DEFAULT_SAMPLE_SIZE
): FieldInfo[] {
    if (!data.length) return [];

    // Get all unique column names
    const columns = new Set<string>();
    data.slice(0, sampleSize).forEach((row) => {
        Object.keys(row).forEach((key) => columns.add(key));
    });

    // Process each column
    return Array.from(columns).map((columnName) => {
        const values = data.slice(0, sampleSize).map((row) => row[columnName]);
        const type = detectFieldType(values);
        const stats = calculateStats(values, type);
        const sparklineData = generateSparklineData(values, type, stats);

        return {
            id: uuidv4(),
            name: columnName,
            type,
            stats,
            sparklineData,
        };
    });
}

/**
 * Detect the type of a field based on sample values
 */
export function detectFieldType(values: unknown[]): FieldType {
    const nonNullValues = values.filter(
        (v) => v !== null && v !== undefined && v !== ''
    );

    if (nonNullValues.length === 0) {
        return 'nominal'; // Default for empty columns
    }

    // Check if temporal (dates)
    const temporalCount = nonNullValues.filter((v) => isTemporalValue(v)).length;
    if (temporalCount / nonNullValues.length > 0.8) {
        return 'temporal';
    }

    // Check if quantitative (numbers)
    const numericCount = nonNullValues.filter((v) => isNumericValue(v)).length;
    if (numericCount / nonNullValues.length > 0.8) {
        // Check if it should be ordinal (low cardinality integers)
        const uniqueValues = new Set(nonNullValues.map((v) => Number(v)));
        const allIntegers = nonNullValues.every(
            (v) => Number.isInteger(Number(v))
        );

        if (allIntegers && uniqueValues.size <= ORDINAL_THRESHOLD) {
            return 'ordinal';
        }
        return 'quantitative';
    }

    // Check if ordinal (low cardinality strings)
    const uniqueStrings = new Set(nonNullValues.map(String));
    if (uniqueStrings.size <= ORDINAL_THRESHOLD && uniqueStrings.size > 0) {
        return 'ordinal';
    }

    return 'nominal';
}

/**
 * Check if a value is a valid date
 */
function isTemporalValue(value: unknown): boolean {
    if (value instanceof Date) return true;
    if (typeof value !== 'string') return false;

    // Try parsing with each format
    for (const format of DATE_FORMATS) {
        try {
            const parsed = parse(value, format, new Date());
            if (isValid(parsed)) return true;
        } catch {
            continue;
        }
    }

    // Try native Date parsing
    const nativeDate = new Date(value);
    return isValid(nativeDate) && !isNaN(nativeDate.getTime());
}

/**
 * Check if a value is numeric
 */
function isNumericValue(value: unknown): boolean {
    if (typeof value === 'number' && !isNaN(value)) return true;
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();
    if (trimmed === '') return false;

    const num = Number(trimmed);
    return !isNaN(num) && isFinite(num);
}

/**
 * Calculate statistics for a field based on its type
 */
export function calculateStats(
    values: unknown[],
    type: FieldType
): FieldStats {
    const nonNullValues = values.filter(
        (v) => v !== null && v !== undefined && v !== ''
    );

    const stats: FieldStats = {
        count: values.length,
        nullCount: values.length - nonNullValues.length,
    };

    if (type === 'quantitative' || type === 'ordinal') {
        const numbers = nonNullValues
            .map((v) => Number(v))
            .filter((n) => !isNaN(n));

        if (numbers.length > 0) {
            stats.min = Math.min(...numbers);
            stats.max = Math.max(...numbers);
            stats.mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;

            // Calculate median
            const sorted = [...numbers].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            stats.median = sorted.length % 2
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2;

            // Calculate standard deviation
            const squaredDiffs = numbers.map((n) => Math.pow(n - stats.mean!, 2));
            stats.stdDev = Math.sqrt(
                squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length
            );
        }
    }

    if (type === 'nominal' || type === 'ordinal') {
        const valueCounts = new Map<string, number>();
        nonNullValues.forEach((v) => {
            const key = String(v);
            valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        });

        stats.uniqueCount = valueCounts.size;
        stats.topValues = Array.from(valueCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([value, count]) => ({ value, count }));
    }

    if (type === 'temporal') {
        const dates = nonNullValues
            .map((v) => parseDate(v))
            .filter((d): d is Date => d !== null)
            .sort((a, b) => a.getTime() - b.getTime());

        if (dates.length > 0) {
            stats.minDate = dates[0].toISOString();
            stats.maxDate = dates[dates.length - 1].toISOString();
        }
    }

    return stats;
}

/**
 * Parse a value as a date
 */
function parseDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value !== 'string') return null;

    for (const format of DATE_FORMATS) {
        try {
            const parsed = parse(value, format, new Date());
            if (isValid(parsed)) return parsed;
        } catch {
            continue;
        }
    }

    const nativeDate = new Date(value);
    return isValid(nativeDate) ? nativeDate : null;
}

/**
 * Generate sparkline data for visualization
 */
export function generateSparklineData(
    values: unknown[],
    type: FieldType,
    stats: FieldStats
): number[] {
    const SPARKLINE_BINS = 10;

    if (type === 'quantitative' && stats.min !== undefined && stats.max !== undefined) {
        // Generate histogram for quantitative data
        const numbers = values
            .map((v) => Number(v))
            .filter((n) => !isNaN(n));

        const range = stats.max - stats.min;
        if (range === 0) {
            return Array(SPARKLINE_BINS).fill(numbers.length);
        }

        const binSize = range / SPARKLINE_BINS;
        const bins = Array(SPARKLINE_BINS).fill(0);

        numbers.forEach((n) => {
            const binIndex = Math.min(
                Math.floor((n - stats.min!) / binSize),
                SPARKLINE_BINS - 1
            );
            bins[binIndex]++;
        });

        return bins;
    }

    if ((type === 'nominal' || type === 'ordinal') && stats.topValues) {
        // Generate bar chart data for categorical fields
        return stats.topValues.slice(0, SPARKLINE_BINS).map((v) => v.count);
    }

    if (type === 'temporal') {
        // Generate time-based histogram
        const dates = values
            .map((v) => parseDate(v))
            .filter((d): d is Date => d !== null)
            .map((d) => d.getTime())
            .sort((a, b) => a - b);

        if (dates.length === 0) return [];

        const minTime = dates[0];
        const maxTime = dates[dates.length - 1];
        const range = maxTime - minTime;

        if (range === 0) {
            return Array(SPARKLINE_BINS).fill(dates.length);
        }

        const binSize = range / SPARKLINE_BINS;
        const bins = Array(SPARKLINE_BINS).fill(0);

        dates.forEach((t) => {
            const binIndex = Math.min(
                Math.floor((t - minTime) / binSize),
                SPARKLINE_BINS - 1
            );
            bins[binIndex]++;
        });

        return bins;
    }

    return [];
}

/**
 * Get a display-friendly label for a field type
 */
export function getFieldTypeLabel(type: FieldType): string {
    const labels: Record<FieldType, string> = {
        nominal: 'Category',
        quantitative: 'Number',
        temporal: 'Date',
        ordinal: 'Ordinal',
    };
    return labels[type];
}

/**
 * Get the CSS class for a field type
 */
export function getFieldTypeClass(type: FieldType): string {
    const classes: Record<FieldType, string> = {
        nominal: 'field-dimension',
        quantitative: 'field-measure',
        temporal: 'field-temporal',
        ordinal: 'field-dimension',
    };
    return classes[type];
}

/**
 * Get color for a field type
 */
export function getFieldTypeColor(type: FieldType): string {
    const colors: Record<FieldType, string> = {
        nominal: '#3b82f6',    // Blue
        quantitative: '#22c55e', // Green
        temporal: '#a855f7',    // Purple
        ordinal: '#3b82f6',     // Blue
    };
    return colors[type];
}
