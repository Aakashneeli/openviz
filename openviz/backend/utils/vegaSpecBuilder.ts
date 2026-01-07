// ============================================
// Vega-Lite Spec Builder
// Converts internal state to valid Vega-Lite JSON
// ============================================

import type {
    ChartConfig,
    ShelfPlacement,
    VegaLiteSpec,
    DataRecord,
    EncodingChannel,
    MarkType
} from '../types';
import { determineChartType } from './autoChart';

/**
 * Build a complete Vega-Lite specification from chart config
 */
export function buildVegaLiteSpec(
    config: ChartConfig,
    data: DataRecord[]
): VegaLiteSpec {
    const mark = config.mark === 'auto'
        ? determineChartType(config.encodings)
        : config.mark;

    const spec: VegaLiteSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        mark: buildMarkSpec(mark, config.fixedColor) as unknown as VegaLiteSpec extends { mark: infer M } ? M : never,
        encoding: buildEncodingSpec(config.encodings),
        width: config.width === 'container' ? 'container' : config.width,
        height: config.height === 'container' ? 'container' : config.height,
    };

    if (config.title) {
        spec.title = config.title;
    }

    // Interactivity is handled at the embed level in VizPreview.tsx
    // Vega-Lite 5 uses 'params' instead of deprecated 'selection'

    return spec;
}

/**
 * Build mark specification
 */
function buildMarkSpec(mark: MarkType, fixedColor?: string): Record<string, unknown> {
    const baseMarks: Record<MarkType, Record<string, unknown>> = {
        bar: { type: 'bar', cornerRadiusEnd: 4 },
        line: { type: 'line', point: true, strokeWidth: 2 },
        point: { type: 'point', filled: true, size: 60 },
        area: { type: 'area', line: true, opacity: 0.7 },
        arc: { type: 'arc', innerRadius: 50 },
        rect: { type: 'rect' },
        rule: { type: 'rule', strokeWidth: 2 },
        text: { type: 'text' },
        tick: { type: 'tick' },
        auto: { type: 'bar', cornerRadiusEnd: 4 },
    };

    const markSpec = { ...(baseMarks[mark] || { type: 'bar' }) };

    // Apply fixed color if specified
    if (fixedColor) {
        markSpec.color = fixedColor;
    }

    return markSpec;
}

/**
 * Build encoding specification from shelf placements
 */
function buildEncodingSpec(
    encodings: ShelfPlacement[]
): Record<string, unknown> {
    const encoding: Record<string, unknown> = {};

    encodings.forEach((placement) => {
        const channelSpec = buildChannelSpec(placement);
        encoding[placement.channel] = channelSpec;
    });

    // Add tooltip if not explicitly set
    if (!encoding.tooltip && encodings.length > 0) {
        encoding.tooltip = encodings.map((e) => ({
            field: e.field.name,
            type: mapFieldTypeToVegaType(e.field.type),
            ...(e.aggregate ? { aggregate: e.aggregate } : {}),
        }));
    }

    return encoding;
}

/**
 * Build specification for a single encoding channel
 */
function buildChannelSpec(placement: ShelfPlacement): Record<string, unknown> {
    const spec: Record<string, unknown> = {
        field: placement.field.name,
        type: mapFieldTypeToVegaType(placement.field.type),
    };

    // Add aggregation
    if (placement.aggregate) {
        spec.aggregate = placement.aggregate;
    }

    // Add binning
    if (placement.bin) {
        spec.bin = typeof placement.bin === 'boolean'
            ? placement.bin
            : placement.bin;
    }

    // Add time unit for temporal fields
    if (placement.timeUnit && placement.field.type === 'temporal') {
        spec.timeUnit = placement.timeUnit;
    }

    // Add sorting
    if (placement.sort) {
        spec.sort = placement.sort;
    }

    // Add axis titles
    if (placement.channel === 'x' || placement.channel === 'y') {
        spec.axis = {
            title: formatFieldTitle(placement),
            grid: true,
            gridOpacity: 0.3,
        };
    }

    // Add legend for color/size/shape
    if (['color', 'size', 'shape'].includes(placement.channel)) {
        spec.legend = {
            title: placement.field.name,
        };
    }

    return spec;
}

/**
 * Map internal field type to Vega-Lite type
 */
function mapFieldTypeToVegaType(
    fieldType: string
): 'quantitative' | 'nominal' | 'ordinal' | 'temporal' {
    const mapping: Record<string, 'quantitative' | 'nominal' | 'ordinal' | 'temporal'> = {
        quantitative: 'quantitative',
        nominal: 'nominal',
        ordinal: 'ordinal',
        temporal: 'temporal',
    };
    return mapping[fieldType] || 'nominal';
}

/**
 * Format field title with aggregation
 */
function formatFieldTitle(placement: ShelfPlacement): string {
    if (placement.aggregate) {
        const aggLabel = placement.aggregate.charAt(0).toUpperCase() +
            placement.aggregate.slice(1);
        return `${aggLabel} of ${placement.field.name}`;
    }
    return placement.field.name;
}

/**
 * Parse a Vega-Lite spec and extract shelf placements
 * (For bi-directional editing)
 */
export function parseVegaLiteSpec(
    spec: VegaLiteSpec,
    availableFields: Map<string, { name: string; type: string }>
): ShelfPlacement[] {
    const placements: ShelfPlacement[] = [];

    if (!spec || typeof spec !== 'object') {
        return placements;
    }

    const encoding = (spec as unknown as Record<string, unknown>).encoding as Record<string, unknown> | undefined;
    if (!encoding) {
        return placements;
    }

    const channels: EncodingChannel[] = ['x', 'y', 'color', 'size', 'shape', 'tooltip', 'row', 'column'];

    channels.forEach((channel) => {
        const channelSpec = encoding[channel] as Record<string, unknown> | undefined;
        if (channelSpec && typeof channelSpec === 'object' && 'field' in channelSpec) {
            const fieldName = channelSpec.field as string;
            const fieldInfo = availableFields.get(fieldName);

            if (fieldInfo) {
                placements.push({
                    id: `${channel}-${fieldName}`,
                    field: {
                        id: fieldName,
                        name: fieldName,
                        type: (fieldInfo.type as 'nominal' | 'quantitative' | 'temporal' | 'ordinal'),
                        stats: { count: 0, nullCount: 0 },
                        sparklineData: [],
                    },
                    channel,
                    aggregate: channelSpec.aggregate as ShelfPlacement['aggregate'],
                    bin: channelSpec.bin as ShelfPlacement['bin'],
                    timeUnit: channelSpec.timeUnit as ShelfPlacement['timeUnit'],
                });
            }
        }
    });

    return placements;
}

/**
 * Generate a minimal spec for preview
 */
export function buildPreviewSpec(
    mark: MarkType,
    xField?: string,
    yField?: string
): VegaLiteSpec {
    return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: [] },
        mark: { type: mark === 'auto' ? 'bar' : mark },
        encoding: {
            ...(xField ? { x: { field: xField, type: 'nominal' } } : {}),
            ...(yField ? { y: { field: yField, type: 'quantitative' } } : {}),
        },
        width: 'container',
        height: 'container',
    };
}
