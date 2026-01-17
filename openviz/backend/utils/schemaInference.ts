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
    DataRecord,
    SemanticType
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
        const semanticType = detectSemanticType(values);
        const stats = calculateStats(values, type);
        const sparklineData = generateSparklineData(values, type, stats);

        return {
            id: uuidv4(),
            name: columnName,
            type,
            semanticType,
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

// ============================================
// Semantic Type Detection (Phase 1 Feature)
// ============================================

// Regex patterns for semantic type detection
// IMPORTANT: These patterns are strict to avoid false positives
const SEMANTIC_PATTERNS: Record<Exclude<SemanticType, 'generic'>, RegExp> = {
    // Email: requires @ and domain
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    // Phone: requires at least 7 digits with optional formatting, must start with + or digit
    phone: /^[\+]?[0-9]{1,4}[-.\s]?[(]?[0-9]{1,4}[)]?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}$/,
    // URL: MUST have http/https OR www prefix to avoid matching decimals
    url: /^(https?:\/\/)(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$|^www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?$/,
    // Currency: MUST have currency symbol (not optional) - symbol before or after
    currency: /^[\$\€\£\¥\₹]\s?[\d,]+\.?\d*$|^[\d,]+\.?\d*\s?[\$\€\£\¥\₹]$/,
    // Percentage: MUST have % symbol
    percentage: /^-?\d+\.?\d*\s?%$/,
    // Country Code: 2-3 uppercase letters (validated against known codes)
    countryCode: /^[A-Z]{2,3}$/,
    // Zip Code: US (5 or 5-4) or UK format
    zipCode: /^\d{5}(-\d{4})?$|^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
};

// Common country codes for validation
const COUNTRY_CODES = new Set([
    'US', 'UK', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN', 'CN', 'JP', 'BR', 'MX',
    'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'KR', 'SG', 'HK',
    'NZ', 'IE', 'AT', 'CH', 'BE', 'PT', 'GR', 'CZ', 'HU', 'RO', 'IL', 'ZA',
    'AE', 'SA', 'EG', 'NG', 'KE', 'TH', 'MY', 'ID', 'PH', 'VN', 'TW', 'AR',
    'CL', 'CO', 'PE', 'VE', 'PK', 'BD', 'UA', 'TR', 'IR', 'IQ',
]);

/**
 * Detect semantic type of a field based on sample values
 * Returns 'generic' if no specific semantic type is detected
 */
export function detectSemanticType(values: unknown[]): SemanticType {
    const nonNullValues = values
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map(String);

    if (nonNullValues.length === 0) {
        return 'generic';
    }

    // Sample up to 100 values for performance
    const sample = nonNullValues.slice(0, 100);
    const matchThreshold = 0.7; // 70% of values must match

    // Check each semantic type
    for (const [semanticType, pattern] of Object.entries(SEMANTIC_PATTERNS)) {
        const matchCount = sample.filter((v) => pattern.test(v.trim())).length;
        const matchRatio = matchCount / sample.length;

        if (matchRatio >= matchThreshold) {
            // Special validation for country codes
            if (semanticType === 'countryCode') {
                const countryMatchCount = sample.filter((v) =>
                    COUNTRY_CODES.has(v.trim().toUpperCase())
                ).length;
                if (countryMatchCount / sample.length >= matchThreshold) {
                    return 'countryCode';
                }
            } else {
                return semanticType as SemanticType;
            }
        }
    }

    return 'generic';
}

/**
 * Get a display-friendly label for a semantic type
 */
export function getSemanticTypeLabel(semanticType: SemanticType): string {
    const labels: Record<SemanticType, string> = {
        email: 'Email',
        phone: 'Phone',
        url: 'URL',
        currency: 'Currency',
        percentage: 'Percentage',
        countryCode: 'Country',
        zipCode: 'Zip Code',
        generic: '',
    };
    return labels[semanticType];
}

/**
 * Get icon name for a semantic type (for UI display)
 */
export function getSemanticTypeIcon(semanticType: SemanticType): string {
    const icons: Record<SemanticType, string> = {
        email: 'mail',
        phone: 'phone',
        url: 'link',
        currency: 'dollar-sign',
        percentage: 'percent',
        countryCode: 'globe',
        zipCode: 'map-pin',
        generic: '',
    };
    return icons[semanticType];
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
