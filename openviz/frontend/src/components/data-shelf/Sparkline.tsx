// ============================================
// Sparkline - Mini visualization for field preview
// ============================================

import { useMemo } from 'react';
import type { FieldType } from '@backend/types';
import { getFieldTypeColor } from '@backend/utils/schemaInference';

interface SparklineProps {
    data: number[];
    type: FieldType;
    width?: number;
    height?: number;
}

export function Sparkline({ data, type, width = 64, height = 16 }: SparklineProps) {
    const color = getFieldTypeColor(type);

    const normalizedData = useMemo(() => {
        if (!data.length) return [];
        const max = Math.max(...data, 1);
        return data.map(v => (v / max) * 100);
    }, [data]);

    if (!data.length) {
        return (
            <div
                className="flex items-center justify-center text-muted-foreground text-xs"
                style={{ width, height }}
            >
                —
            </div>
        );
    }

    return (
        <div
            className="flex items-end gap-px"
            style={{ width, height }}
        >
            {normalizedData.map((value, index) => (
                <div
                    key={index}
                    className="rounded-t-sm transition-all"
                    style={{
                        height: `${Math.max(value, 5)}%`,
                        width: `${100 / normalizedData.length}%`,
                        minWidth: 2,
                        backgroundColor: color,
                        opacity: 0.7 + (value / 100) * 0.3,
                    }}
                />
            ))}
        </div>
    );
}

// Simple bar sparkline for categorical data (horizontal)
export function CategoricalSparkline({ data, type }: SparklineProps) {
    const color = getFieldTypeColor(type);

    const normalizedData = useMemo(() => {
        if (!data.length) return [];
        const max = Math.max(...data, 1);
        return data.map(v => (v / max) * 100);
    }, [data]);

    if (!data.length) {
        return <div className="text-muted-foreground text-xs">—</div>;
    }

    return (
        <div className="flex flex-col gap-0.5 w-16">
            {normalizedData.slice(0, 5).map((value, index) => (
                <div
                    key={index}
                    className="h-1 rounded-r-sm"
                    style={{
                        width: `${Math.max(value, 10)}%`,
                        backgroundColor: color,
                        opacity: 0.6 + (value / 100) * 0.4,
                    }}
                />
            ))}
        </div>
    );
}
