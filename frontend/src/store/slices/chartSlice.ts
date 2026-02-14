import { v4 as uuidv4 } from 'uuid';
import type {
    FieldInfo,
    ShelfPlacement,
    ChartConfig,
    MarkType,
    EncodingChannel,
    EChartsOption,
    ChartSuggestion,
} from '@backend/types';
import { buildEChartsOption } from '@backend/utils/echartsOptionBuilder';
import { getDrillData, getCurrentDrillLevel } from '@backend/services/drillService';
import { getChartSuggestions } from '@backend/utils/autoChart';
import type { StoreSet, StoreGet } from './types';

// ============================================
// Initial Chart Config (exported for use by other slices)
// ============================================

export const initialChartConfig: ChartConfig = {
    id: uuidv4(),
    mark: 'auto',
    encodings: [],
    width: 'container',
    height: 400,
    interactive: true,
};

// ============================================
// Chart Slice
// ============================================

export const createChartSlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    chartConfig: initialChartConfig as ChartConfig,
    encodings: [] as ShelfPlacement[],
    echartsOption: null as EChartsOption | null,
    showAnnotations: true,

    // Actions

    addToShelf: (field: FieldInfo, channel: EncodingChannel) => {
        const state = get() as any;
        const { encodings, dataset } = state;

        // Remove any existing placement in this channel
        const filteredEncodings = encodings.filter((e: ShelfPlacement) => e.channel !== channel);

        // Remove this field from any other channel
        const withoutField = filteredEncodings.filter(
            (e: ShelfPlacement) => e.field.id !== field.id
        );

        const newPlacement: ShelfPlacement = {
            id: uuidv4(),
            field,
            channel,
        };

        const newEncodings = [...withoutField, newPlacement];

        // Clear drill state when x-axis changes (drill path becomes invalid)
        const xChanged = channel === 'x' || encodings.find((e: ShelfPlacement) => e.channel === 'x')?.field.id !== newEncodings.find((e: ShelfPlacement) => e.channel === 'x')?.field.id;
        if (xChanged && state.drillPath.length > 0) {
            set({ drillPath: [], drillActiveField: null });
        }

        set({ encodings: newEncodings });

        // Regenerate spec
        if (dataset) {
            (get() as any).regenerateSpec();
        }
    },

    removeFromShelf: (channel: EncodingChannel) => {
        const state = get() as any;
        const { encodings, dataset } = state;
        const newEncodings = encodings.filter((e: ShelfPlacement) => e.channel !== channel);

        set({ encodings: newEncodings });

        if (dataset) {
            (get() as any).regenerateSpec();
        }
    },

    updateShelfConfig: (channel: EncodingChannel, config: Partial<Pick<ShelfPlacement, 'aggregate' | 'bin' | 'timeUnit' | 'sort'>>) => {
        const state = get() as any;
        const { encodings, dataset } = state;
        const newEncodings = encodings.map((e: ShelfPlacement) =>
            e.channel === channel ? { ...e, ...config } : e
        );

        set({ encodings: newEncodings });

        if (dataset) {
            (get() as any).regenerateSpec();
        }
    },

    clearAllShelves: () => {
        set({ encodings: [], echartsOption: null });
    },

    swapChannels: (from: EncodingChannel, to: EncodingChannel) => {
        const state = get() as any;
        const { encodings, dataset } = state;
        const newEncodings = encodings.map((e: ShelfPlacement) => {
            if (e.channel === from) return { ...e, channel: to };
            if (e.channel === to) return { ...e, channel: from };
            return e;
        });

        set({ encodings: newEncodings });

        if (dataset) {
            (get() as any).regenerateSpec();
        }
    },

    setMark: (mark: MarkType) => {
        const state = get() as any;
        const { chartConfig, dataset } = state;
        set({
            chartConfig: { ...chartConfig, mark },
        });

        if (dataset) {
            (get() as any).regenerateSpec();
        }
    },

    setTitle: (title: string) => {
        const state = get() as any;
        const { chartConfig } = state;
        set({
            chartConfig: { ...chartConfig, title },
        });
        (get() as any).regenerateSpec();
    },

    setDimensions: (width: number | 'container', height: number | 'container') => {
        const state = get() as any;
        const { chartConfig } = state;
        set({
            chartConfig: { ...chartConfig, width, height },
        });
        (get() as any).regenerateSpec();
    },

    resetChart: () => {
        set({
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
            chartSummary: null,
            aiInsights: [],
        });
    },

    applyTemplate: (template: import('@/data/chartTemplates').ChartTemplate) => {
        const state = get() as any;
        const { dataset } = state;
        if (!dataset) return;

        // Dynamic import to avoid circular dependency
        import('@/data/chartTemplates').then(({ autoMapFields }) => {
            const fields = dataset.fields.map((f: FieldInfo) => ({ name: f.name, type: f.type }));
            const mapping = autoMapFields(template, fields);

            // Build new encodings from the mapping
            const newEncodings: ShelfPlacement[] = [];
            for (const slot of template.slots) {
                const mapped = mapping.get(slot.channel);
                if (!mapped) continue;

                // Find the full FieldInfo object
                const fieldInfo = dataset.fields.find((f: FieldInfo) => f.name === mapped.name);
                if (!fieldInfo) continue;

                newEncodings.push({
                    id: uuidv4(),
                    field: fieldInfo,
                    channel: slot.channel,
                    aggregate: slot.aggregate,
                });
            }

            // Apply everything at once
            (get() as any).pushToHistory();
            set({
                chartConfig: {
                    ...(get() as any).chartConfig,
                    id: uuidv4(),
                    mark: template.mark,
                    title: template.name,
                    encodings: newEncodings,
                    fixedColor: template.fixedColor,
                },
                encodings: newEncodings,
            });

            (get() as any).regenerateSpec();
        });
    },

    toggleAnnotations: () => {
        const state = get() as any;
        const { showAnnotations } = state;
        set({ showAnnotations: !showAnnotations });
        // Regenerate chart to apply/remove annotations
        (get() as any).regenerateSpec();
    },

    updateSpecFromJson: (option: EChartsOption) => {
        set({ echartsOption: option });
        // TODO: Parse option back to encodings for bi-directional editing
    },

    regenerateSpec: () => {
        const state = get() as any;
        const { dataset, chartConfig, encodings, showAnnotations, filteredData, forecastData, comparisonResult, drillPath, drillHierarchies, drillActiveField } = state;

        if (!dataset || encodings.length === 0) {
            set({ echartsOption: null });
            return;
        }

        // Use filtered data if active, otherwise full dataset
        let dataToUse = filteredData ?? dataset.data;
        let effectiveEncodings = encodings;

        // Apply drill-down data transformation
        if (drillPath.length > 0 && drillActiveField) {
            const hierarchy = drillHierarchies.find((h: any) => h.sourceField === drillActiveField);
            if (hierarchy && hierarchy.type === 'temporal') {
                const currentLevel = getCurrentDrillLevel(drillPath, hierarchy.availableLevels);
                const drillResult = getDrillData(dataToUse, drillActiveField, drillPath, currentLevel);
                dataToUse = drillResult.data;

                // Replace the temporal x-axis encoding with the drill field
                const xEncoding = encodings.find((e: ShelfPlacement) => e.channel === 'x' && e.field.name === drillActiveField);
                if (xEncoding) {
                    effectiveEncodings = encodings.map((e: ShelfPlacement) => {
                        if (e.channel === 'x' && e.field.name === drillActiveField) {
                            return {
                                ...e,
                                field: {
                                    ...e.field,
                                    name: drillResult.drillField,
                                    type: 'nominal' as const, // Drill categories are nominal
                                },
                                timeUnit: undefined, // Don't apply time unit to drill field
                            };
                        }
                        return e;
                    });
                }
            }
        }

        const configWithEncodings: ChartConfig = {
            ...chartConfig,
            encodings: effectiveEncodings,
            // Remove annotations if toggle is off
            annotations: showAnnotations ? chartConfig.annotations : undefined,
        };

        let option = buildEChartsOption(configWithEncodings, dataToUse);

        // Append forecast series if present
        if (forecastData && forecastData.points.length > 0) {
            const series = (option.series as unknown[]) || [];
            // Dashed forecast line
            const forecastSeries = {
                type: 'line',
                name: 'Forecast',
                data: forecastData.points.map((p: any) => [p.x, p.y]),
                lineStyle: { type: 'dashed', width: 2, color: '#06b6d4' },
                itemStyle: { color: '#06b6d4' },
                symbol: 'diamond',
                symbolSize: 6,
            };
            series.push(forecastSeries);

            // Confidence interval area
            if (forecastData.points[0]?.lower !== undefined) {
                const ciSeries = {
                    type: 'line',
                    name: 'Confidence Interval',
                    data: forecastData.points.map((p: any) => [p.x, p.lower, p.upper]),
                    lineStyle: { opacity: 0 },
                    areaStyle: { color: '#06b6d4', opacity: 0.1 },
                    stack: undefined,
                    symbol: 'none',
                    encode: undefined,
                };
                series.push(ciSeries);
            }

            option = { ...option, series: series as EChartsOption['series'] };
        }

        // Add comparison annotations if present
        if (comparisonResult) {
            const series = (option.series as Record<string, unknown>[]) || [];
            if (series.length > 0 && !series[0].markLine) {
                series[0] = {
                    ...series[0],
                    markLine: {
                        data: [
                            { yAxis: comparisonResult.groupA.value, name: comparisonResult.groupA.label, lineStyle: { color: '#3b82f6', type: 'dashed' } },
                            { yAxis: comparisonResult.groupB.value, name: comparisonResult.groupB.label, lineStyle: { color: '#f59e0b', type: 'dashed' } },
                        ],
                        label: { show: true, color: '#d4d4d8', fontSize: 11 },
                    },
                };
            }
            option = { ...option, series };
        }

        set({ echartsOption: option });

        // Update suggestions based on current encodings
        const suggestions = getChartSuggestions(encodings).map((s: any) => ({
            id: uuidv4(),
            title: `${s.mark.charAt(0).toUpperCase() + s.mark.slice(1)} Chart`,
            description: s.reason,
            config: { ...chartConfig, mark: s.mark, encodings },
            score: s.score,
        }));

        set({ aiSuggestions: suggestions });
    },

    applySuggestion: (suggestion: ChartSuggestion) => {
        set({
            chartConfig: suggestion.config,
            encodings: suggestion.config.encodings,
        });
        (get() as any).regenerateSpec();
    },
});
