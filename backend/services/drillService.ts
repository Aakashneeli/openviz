// ============================================
// Drill-Down Service
// Detects hierarchies and transforms data for
// drill-down navigation (temporal & categorical)
// ============================================

import type {
    FieldInfo,
    DataRecord,
    TemporalDrillLevel,
    DrillLevel,
    DrillHierarchy,
} from '../types';

// ============================================
// Temporal Hierarchy
// ============================================

const TEMPORAL_LEVELS: TemporalDrillLevel[] = ['year', 'quarter', 'month', 'week', 'day'];

/**
 * Parse a value to a Date object, returning null if invalid
 */
function parseDate(value: unknown): Date | null {
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Extract a temporal component from a date
 */
export function extractTemporalComponent(date: Date, level: TemporalDrillLevel): string {
    switch (level) {
        case 'year':
            return String(date.getFullYear());
        case 'quarter':
            return `Q${Math.floor(date.getMonth() / 3) + 1}`;
        case 'month':
            return date.toLocaleString('en-US', { month: 'short' });
        case 'week': {
            // ISO week number
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return `W${weekNo}`;
        }
        case 'day':
            return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
        default:
            return String(date);
    }
}

/**
 * Get a sortable numeric key for temporal component so drill data stays ordered
 */
function getTemporalSortKey(date: Date, level: TemporalDrillLevel): number {
    switch (level) {
        case 'year': return date.getFullYear();
        case 'quarter': return Math.floor(date.getMonth() / 3) + 1;
        case 'month': return date.getMonth();
        case 'week': {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        }
        case 'day': return date.getDate();
        default: return 0;
    }
}

/**
 * Detect the initial temporal drill level based on data range
 */
function detectInitialTemporalLevel(data: DataRecord[], field: string): TemporalDrillLevel {
    const dates = data
        .map(row => parseDate(row[field]))
        .filter((d): d is Date => d !== null);

    if (dates.length < 2) return 'day';

    const min = Math.min(...dates.map(d => d.getTime()));
    const max = Math.max(...dates.map(d => d.getTime()));
    const rangeMs = max - min;
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24);

    if (rangeDays > 730) return 'year';     // > 2 years
    if (rangeDays > 180) return 'quarter';  // > 6 months
    if (rangeDays > 60) return 'month';     // > 2 months
    if (rangeDays > 14) return 'week';      // > 2 weeks
    return 'day';
}

/**
 * Get the next drill level below the current one
 */
export function getNextDrillLevel(current: TemporalDrillLevel): TemporalDrillLevel | null {
    const idx = TEMPORAL_LEVELS.indexOf(current);
    if (idx === -1 || idx >= TEMPORAL_LEVELS.length - 1) return null;
    return TEMPORAL_LEVELS[idx + 1];
}

/**
 * Check if a date matches a drill level + value
 */
function dateMatchesDrillLevel(date: Date, level: TemporalDrillLevel | string, value: string | number): boolean {
    const component = extractTemporalComponent(date, level as TemporalDrillLevel);
    return component === String(value);
}

// ============================================
// Hierarchy Detection
// ============================================

/**
 * Detect which fields support drill-down navigation
 */
export function detectHierarchies(fields: FieldInfo[], data: DataRecord[]): DrillHierarchy[] {
    const hierarchies: DrillHierarchy[] = [];

    for (const field of fields) {
        // Temporal fields always support drill-down
        if (field.type === 'temporal') {
            const initialLevel = detectInitialTemporalLevel(data, field.name);
            const startIdx = TEMPORAL_LEVELS.indexOf(initialLevel);
            hierarchies.push({
                type: 'temporal',
                sourceField: field.name,
                availableLevels: TEMPORAL_LEVELS.slice(startIdx),
            });
        }
    }

    return hierarchies;
}

// ============================================
// Data Transformation for Drill Levels
// ============================================

/**
 * Filter data based on the current drill path and return data
 * with a new virtual column for the current drill level
 */
export function getDrillData(
    data: DataRecord[],
    field: string,
    drillPath: DrillLevel[],
    currentLevel: TemporalDrillLevel,
): { data: DataRecord[]; drillField: string } {
    // First, filter data based on drill path (each level narrows the data)
    let filteredData = data;

    for (const step of drillPath) {
        filteredData = filteredData.filter(row => {
            const date = parseDate(row[field]);
            if (!date) return false;
            return dateMatchesDrillLevel(date, step.level, step.value);
        });
    }

    // Create a virtual column with the current drill level label
    const drillField = `__drill_${currentLevel}`;
    const augmented = filteredData.map(row => {
        const date = parseDate(row[field]);
        if (!date) return { ...row, [drillField]: 'Unknown', __drillSortKey: 0 };
        return {
            ...row,
            [drillField]: extractTemporalComponent(date, currentLevel),
            __drillSortKey: getTemporalSortKey(date, currentLevel),
        };
    });

    // Sort by the temporal sort key
    augmented.sort((a, b) => (a.__drillSortKey as number) - (b.__drillSortKey as number));

    // Remove sort key from output
    const result = augmented.map(({ __drillSortKey: _, ...rest }) => rest);

    return { data: result, drillField };
}

/**
 * Get the full label for a drill path: "All > 2024 > Q3 > August"
 */
export function getDrillPathLabel(drillPath: DrillLevel[]): string {
    if (drillPath.length === 0) return 'All';
    return 'All > ' + drillPath.map(step => step.label).join(' > ');
}

/**
 * Determine the current drill level based on path and available levels
 */
export function getCurrentDrillLevel(
    drillPath: DrillLevel[],
    availableLevels: string[],
): TemporalDrillLevel {
    if (drillPath.length === 0) return availableLevels[0] as TemporalDrillLevel;
    // Current display level is one step below the deepest drilled level
    const lastDrilledLevel = drillPath[drillPath.length - 1].level;
    const idx = availableLevels.indexOf(lastDrilledLevel);
    if (idx >= 0 && idx < availableLevels.length - 1) {
        return availableLevels[idx + 1] as TemporalDrillLevel;
    }
    return lastDrilledLevel as TemporalDrillLevel;
}

/**
 * Check if further drill-down is possible from the current level
 */
export function canDrillDeeper(
    drillPath: DrillLevel[],
    availableLevels: string[],
): boolean {
    if (drillPath.length === 0) return availableLevels.length > 1;
    const lastLevel = drillPath[drillPath.length - 1].level;
    const idx = availableLevels.indexOf(lastLevel);
    // Can drill deeper if there are at least 2 more levels (current display + next)
    return idx >= 0 && idx < availableLevels.length - 2;
}
