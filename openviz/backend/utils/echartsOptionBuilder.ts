// ============================================
// ECharts Option Builder
// Converts internal state to valid ECharts option
// Supports advanced chart types: radar, heatmap, treemap, sunburst, funnel, gauge, sankey, boxplot
// ============================================

import type {
    ChartConfig,
    ShelfPlacement,
    DataRecord,
    MarkType,
    FieldType,
    EChartsOption,
    Annotation
} from '../types';
import { determineChartType } from './autoChart';

// ============================================
// Utility Functions
// ============================================

function getAxisType(fieldType: FieldType): 'category' | 'value' | 'time' {
    switch (fieldType) {
        case 'nominal':
        case 'ordinal':
            return 'category';
        case 'temporal':
            return 'time';
        case 'quantitative':
        default:
            return 'value';
    }
}

// Default color palette matching OpenViz theme
const DEFAULT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
    '#84cc16', '#14b8a6', '#a855f7', '#f43f5e',
];

// Common tooltip style
const TOOLTIP_STYLE = {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderColor: '#333',
    textStyle: { color: '#fff', fontSize: 12 },
};

// Common title style
function buildTitleOption(title?: string) {
    if (!title) return undefined;
    return {
        text: title,
        left: 'center',
        textStyle: {
            color: '#fafafa',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Outfit, sans-serif',
        },
    };
}

// Common toolbox
const TOOLBOX = {
    feature: { saveAsImage: { title: 'Save' } },
    iconStyle: { borderColor: '#a1a1aa' },
    right: 20,
    top: 10,
};

// ============================================
// Annotation Helpers
// ============================================

/**
 * Build ECharts markPoint configuration from annotations
 */
function buildMarkPoint(annotations: Annotation[]): Record<string, unknown> {
    const markData = annotations
        .filter(a => a.type === 'max' || a.type === 'min' || a.type === 'outlier')
        .map(a => {
            const symbol = a.type === 'max' ? 'pin' : a.type === 'min' ? 'pin' : 'circle';
            const symbolSize = a.type === 'outlier' ? 50 : 60;

            return {
                name: a.label,
                coord: a.coord,
                value: a.value,
                symbol,
                symbolSize,
                symbolRotate: a.type === 'min' ? 180 : 0,
                itemStyle: {
                    color: a.type === 'max' ? '#10b981' : a.type === 'min' ? '#ef4444' : '#f59e0b',
                },
                label: {
                    show: true,
                    formatter: a.label,
                    position: 'top',
                    color: '#fafafa',
                    fontSize: 11,
                    fontWeight: 500,
                },
            };
        });

    return {
        data: markData,
        animation: true,
        animationDuration: 500,
    };
}

/**
 * Build ECharts markLine configuration for average/trend lines
 */
function buildMarkLine(data: number[], showAverage: boolean = true): Record<string, unknown> | undefined {
    if (!showAverage || data.length === 0) return undefined;

    return {
        data: [
            {
                type: 'average',
                name: 'Average',
                label: {
                    formatter: 'Avg: {c}',
                    position: 'end',
                    color: '#a1a1aa',
                    fontSize: 11,
                },
                lineStyle: {
                    color: '#8b5cf6',
                    type: 'dashed',
                    width: 2,
                },
            },
        ],
        animation: true,
    };
}

// ============================================
// Main Entry Point
// ============================================

export function buildEChartsOption(
    config: ChartConfig,
    data: DataRecord[]
): EChartsOption {
    const mark = config.mark === 'auto'
        ? determineChartType(config.encodings)
        : config.mark;

    // Route to specialized builders
    switch (mark) {
        case 'arc':
            return buildPieChartOption(config, data);
        case 'radar':
            return buildRadarChartOption(config, data);
        case 'heatmap':
            return buildHeatmapOption(config, data);
        case 'treemap':
            return buildTreemapOption(config, data);
        case 'sunburst':
            return buildSunburstOption(config, data);
        case 'funnel':
            return buildFunnelOption(config, data);
        case 'gauge':
            return buildGaugeOption(config, data);
        case 'sankey':
            return buildSankeyOption(config, data);
        case 'boxplot':
            return buildBoxplotOption(config, data);
        case 'candlestick':
            return buildCandlestickOption(config, data);
        case 'graph':
            return buildGraphOption(config, data);
        // New advanced chart types
        case 'histogram':
            return buildHistogramOption(config, data);
        case 'tree':
            return buildTreeOption(config, data);
        case 'parallel':
            return buildParallelOption(config, data);
        case 'waterfall':
            return buildWaterfallOption(config, data);
        case 'calendar':
            return buildCalendarOption(config, data);
        case 'pictorialBar':
            return buildPictorialBarOption(config, data);
        default:
            return buildCartesianChart(config, data, mark);
    }
}

// ============================================
// Cartesian Charts (Bar, Line, Scatter, Area)
// ============================================

function buildCartesianChart(
    config: ChartConfig,
    data: DataRecord[],
    mark: MarkType
): EChartsOption {
    const seriesType = mapMarkToSeriesType(mark);
    const xEncoding = config.encodings.find(e => e.channel === 'x');
    const yEncoding = config.encodings.find(e => e.channel === 'y');
    const colorEncoding = config.encodings.find(e => e.channel === 'color');
    const sizeEncoding = config.encodings.find(e => e.channel === 'size');

    let processedData = processDataWithAggregation(data, config.encodings);

    // CRITICAL FIX: Sort data by X-axis for line and area charts
    // This ensures the line connects points in the correct order
    if (xEncoding && (seriesType === 'line' || mark === 'area')) {
        const xField = xEncoding.field.name;
        const xType = xEncoding.field.type;

        processedData = [...processedData].sort((a, b) => {
            const aVal = a[xField];
            const bVal = b[xField];

            // Handle temporal data - parse dates for correct sorting
            if (xType === 'temporal') {
                const aDate = new Date(String(aVal)).getTime();
                const bDate = new Date(String(bVal)).getTime();
                return aDate - bDate;
            }
            // Handle numeric data
            if (xType === 'quantitative') {
                return (Number(aVal) || 0) - (Number(bVal) || 0);
            }
            // Handle categorical - sort alphabetically
            return String(aVal).localeCompare(String(bVal));
        });
    }

    const option: EChartsOption = {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: {
            trigger: 'axis',
            ...TOOLTIP_STYLE,
            axisPointer: { type: seriesType === 'bar' ? 'shadow' : 'cross' },
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: config.title ? 60 : 40,
            containLabel: true,
        },
        toolbox: TOOLBOX,
    };

    // Configure axes - ALWAYS use category axis for X to ensure proper distribution
    // This fixes the issue where temporal/value axes cluster points together
    if (xEncoding) {
        const xFieldType = xEncoding.field.type;
        // For line/area charts, always use category axis for reliable X-axis distribution
        // Time axis can cause clustering issues when dates aren't properly parsed
        const useCategory = seriesType === 'line' || mark === 'area' ||
            xFieldType === 'nominal' || xFieldType === 'ordinal' || xFieldType === 'temporal';

        const xCategories = processedData.map(d => {
            const val = d[xEncoding.field.name];
            // Format dates for display
            if (xFieldType === 'temporal' && val) {
                const date = new Date(String(val));
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: processedData.length > 365 ? '2-digit' : undefined
                    });
                }
            }
            return String(val ?? '');
        });

        const xAxisConfig: Record<string, unknown> = {
            type: useCategory ? 'category' : getAxisType(xFieldType),
            data: useCategory ? xCategories : undefined,
            name: xEncoding.field.name,
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: '#e4e4e7', fontSize: 12 },
            axisLabel: {
                color: '#a1a1aa',
                fontSize: 11,
                rotate: xCategories.length > 10 ? 45 : 0, // Rotate labels if too many
                interval: xCategories.length > 20 ? Math.floor(xCategories.length / 20) : 0, // Skip some labels if crowded
            },
            axisLine: { lineStyle: { color: '#3f3f46' } },
            splitLine: { lineStyle: { color: '#27272a' } },
        };
        option.xAxis = xAxisConfig;
    }

    if (yEncoding) {
        const yAxisType = getAxisType(yEncoding.field.type);
        const yAxisConfig: Record<string, unknown> = {
            type: yAxisType,
            name: formatAxisTitle(yEncoding),
            nameTextStyle: { color: '#e4e4e7', fontSize: 12 },
            axisLabel: { color: '#a1a1aa', fontSize: 11 },
            axisLine: { lineStyle: { color: '#3f3f46' } },
            splitLine: { lineStyle: { color: '#27272a' } },
        };
        // For category axes, set explicit data
        if (yAxisType === 'category') {
            yAxisConfig.data = [...new Set(processedData.map(d => d[yEncoding.field.name]))];
        }
        option.yAxis = yAxisConfig;
    }

    // Build series
    const baseSeries: Record<string, unknown> = {
        type: seriesType,
        // Don't use encode - use explicit data array for reliable rendering
    };

    if (config.fixedColor) {
        baseSeries.itemStyle = { color: config.fixedColor };
    }

    // Chart-specific styling
    if (mark === 'area') {
        baseSeries.areaStyle = { opacity: 0.7 };
    }
    if (seriesType === 'line') {
        baseSeries.smooth = true;
        baseSeries.symbol = 'circle';
        baseSeries.symbolSize = 6;
    }
    if (seriesType === 'bar') {
        baseSeries.barMaxWidth = 50;
        baseSeries.itemStyle = { ...(baseSeries.itemStyle as object || {}), borderRadius: [4, 4, 0, 0] };
    }
    if (seriesType === 'scatter') {
        baseSeries.symbolSize = sizeEncoding ? 20 : 10;
    }

    // Handle color grouping
    if (colorEncoding && colorEncoding.field.type !== 'quantitative') {
        const colorField = colorEncoding.field.name;
        const uniqueValues = [...new Set(data.map(d => String(d[colorField])))];
        option.legend = { show: true, top: 10, textStyle: { color: '#d4d4d8' } };
        option.series = uniqueValues.map((value, index) => ({
            ...baseSeries,
            name: value,
            data: processedData
                .filter(d => String(d[colorField]) === value)
                .map(d => [d[xEncoding?.field.name || ''], d[yEncoding?.field.name || '']]),
            encode: undefined,
            itemStyle: { color: DEFAULT_COLORS[index % DEFAULT_COLORS.length] },
        }));
    } else {
        // Use explicit data array for reliable rendering
        // For category X-axis: use just Y values (in order matching xAxis.data)
        // For value X-axis: use [x, y] pairs
        const useCategory = seriesType === 'line' || mark === 'area' ||
            xEncoding?.field.type === 'nominal' || xEncoding?.field.type === 'ordinal' ||
            xEncoding?.field.type === 'temporal';

        const seriesData = processedData.map(d => {
            const yVal = yEncoding ? d[yEncoding.field.name] : null;
            if (useCategory) {
                // Category axis: just return Y values in order
                return yVal;
            } else {
                // Value axis: use [x, y] pairs
                const xVal = xEncoding ? d[xEncoding.field.name] : null;
                return [xVal, yVal];
            }
        });

        const series: Record<string, unknown> = {
            ...baseSeries,
            data: seriesData,
        };

        // Add annotations if present
        if (config.annotations && config.annotations.length > 0) {
            series.markPoint = buildMarkPoint(config.annotations);

            // Add average line for quantitative Y axis
            if (yEncoding?.field.type === 'quantitative') {
                const yValues = processedData
                    .map(d => Number(d[yEncoding.field.name]))
                    .filter(v => !isNaN(v));
                series.markLine = buildMarkLine(yValues, true);
            }
        }

        option.series = [series];
    }

    return option;
}

function mapMarkToSeriesType(mark: MarkType): string {
    const mapping: Record<string, string> = {
        bar: 'bar',
        line: 'line',
        point: 'scatter',
        area: 'line',
        rect: 'heatmap',
        rule: 'line',
        text: 'scatter',
        tick: 'scatter',
    };
    return mapping[mark] || 'bar';
}

// ============================================
// Pie/Donut Chart
// ============================================

function buildPieChartOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    // Support both encoding patterns:
    // 1. Legacy: x (category) + y (value)
    // 2. AI-generated: x/color (category) + theta (value)
    const categoryEncoding = config.encodings.find(e => e.channel === 'x')
        || config.encodings.find(e => e.channel === 'color');
    const valueEncoding = config.encodings.find(e => e.channel === 'theta')
        || config.encodings.find(e => e.channel === 'y');
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    // Debug logging for troubleshooting
    console.log('[PieChart] Encodings:', config.encodings.map(e => `${e.channel}=${e.field.name}`));
    console.log('[PieChart] Category field:', categoryField, 'Value field:', valueField);

    const aggregated = new Map<string, number>();
    for (const row of data) {
        const key = String(row[categoryField] || 'Unknown');
        const val = Number(row[valueField]) || 0;
        aggregated.set(key, (aggregated.get(key) || 0) + val);
    }

    const pieData = Array.from(aggregated.entries()).map(([name, value]) => ({ name, value }));

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', ...TOOLTIP_STYLE },
        legend: { orient: 'vertical', left: 'left', textStyle: { color: '#d4d4d8' } },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '55%'],
            data: pieData,
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
            label: { color: '#d4d4d8' },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Radar Chart
// ============================================

function buildRadarChartOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const categoryEncoding = config.encodings.find(e => e.channel === 'x');
    const valueEncoding = config.encodings.find(e => e.channel === 'y');
    const colorEncoding = config.encodings.find(e => e.channel === 'color');

    // Get indicators (dimensions) from data
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';
    const colorField = colorEncoding?.field.name || '';

    const categories = [...new Set(data.map(d => String(d[categoryField])))];
    const maxValue = Math.max(...data.map(d => Number(d[valueField]) || 0)) * 1.2;

    const indicator = categories.map(name => ({ name, max: maxValue }));

    // Group by color field if present
    let seriesData: { name: string; value: number[] }[] = [];
    if (colorField) {
        const groups = [...new Set(data.map(d => String(d[colorField])))];
        seriesData = groups.map(group => ({
            name: group,
            value: categories.map(cat => {
                const row = data.find(d => String(d[categoryField]) === cat && String(d[colorField]) === group);
                return Number(row?.[valueField]) || 0;
            }),
        }));
    } else {
        seriesData = [{
            name: 'Values',
            value: categories.map(cat => {
                const row = data.find(d => String(d[categoryField]) === cat);
                return Number(row?.[valueField]) || 0;
            }),
        }];
    }

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'item', ...TOOLTIP_STYLE },
        legend: { top: 10, textStyle: { color: '#d4d4d8' } },
        radar: {
            indicator,
            axisName: { color: '#a1a1aa' },
            axisLine: { lineStyle: { color: '#3f3f46' } },
            splitLine: { lineStyle: { color: '#27272a' } },
            splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } },
        },
        series: [{
            type: 'radar',
            data: seriesData,
            areaStyle: { opacity: 0.3 },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Heatmap
// ============================================

function buildHeatmapOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEncoding = config.encodings.find(e => e.channel === 'x');
    const yEncoding = config.encodings.find(e => e.channel === 'y');
    const colorEncoding = config.encodings.find(e => e.channel === 'color') ||
        config.encodings.find(e => e.channel === 'size');

    const xField = xEncoding?.field.name || '';
    const yField = yEncoding?.field.name || '';
    const valueField = colorEncoding?.field.name || yField;

    const xCategories = [...new Set(data.map(d => String(d[xField])))];
    const yCategories = [...new Set(data.map(d => String(d[yField])))];

    const heatmapData = data.map(d => [
        xCategories.indexOf(String(d[xField])),
        yCategories.indexOf(String(d[yField])),
        Number(d[valueField]) || 0,
    ]);

    const values = heatmapData.map(d => d[2] as number);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return {
        backgroundColor: 'transparent',
        title: buildTitleOption(config.title),
        tooltip: { position: 'top', ...TOOLTIP_STYLE },
        grid: { left: '3%', right: '10%', bottom: '3%', top: 60, containLabel: true },
        xAxis: {
            type: 'category',
            data: xCategories,
            axisLabel: { color: '#a1a1aa', fontSize: 10 },
            axisLine: { lineStyle: { color: '#3f3f46' } },
        },
        yAxis: {
            type: 'category',
            data: yCategories,
            axisLabel: { color: '#a1a1aa', fontSize: 10 },
            axisLine: { lineStyle: { color: '#3f3f46' } },
        },
        visualMap: {
            min: minValue,
            max: maxValue,
            calculable: true,
            orient: 'vertical',
            right: 0,
            top: 'center',
            inRange: { color: ['#1e3a5f', '#3b82f6', '#93c5fd'] },
            textStyle: { color: '#a1a1aa' },
        },
        series: [{
            type: 'heatmap',
            data: heatmapData,
            label: { show: true, color: '#fff', fontSize: 10 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Treemap
// ============================================

function buildTreemapOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const categoryEncoding = config.encodings.find(e => e.channel === 'x');
    const valueEncoding = config.encodings.find(e => e.channel === 'y');
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    const treemapData = data.map(d => ({
        name: String(d[categoryField]),
        value: Number(d[valueField]) || 0,
    }));

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { formatter: '{b}: {c}', ...TOOLTIP_STYLE },
        series: [{
            type: 'treemap',
            data: treemapData,
            roam: false,
            breadcrumb: { show: true, itemStyle: { color: '#27272a' }, textStyle: { color: '#d4d4d8' } },
            label: { show: true, color: '#fff', fontSize: 12 },
            itemStyle: { borderColor: '#18181b', borderWidth: 2, gapWidth: 2 },
            levels: [
                { itemStyle: { borderWidth: 0, gapWidth: 5 } },
                { itemStyle: { gapWidth: 1 } },
            ],
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Sunburst
// ============================================

function buildSunburstOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const categoryEncoding = config.encodings.find(e => e.channel === 'x');
    const valueEncoding = config.encodings.find(e => e.channel === 'y');
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    const sunburstData = data.map(d => ({
        name: String(d[categoryField]),
        value: Number(d[valueField]) || 0,
    }));

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { formatter: '{b}: {c}', ...TOOLTIP_STYLE },
        series: [{
            type: 'sunburst',
            data: sunburstData,
            radius: ['15%', '80%'],
            label: { color: '#d4d4d8', fontSize: 10 },
            itemStyle: { borderColor: '#18181b', borderWidth: 2 },
            emphasis: { focus: 'ancestor' },
            levels: [
                {},
                { r0: '15%', r: '35%', itemStyle: { borderWidth: 2 }, label: { rotate: 'tangential' } },
                { r0: '35%', r: '55%', label: { align: 'right' } },
                { r0: '55%', r: '70%', label: { position: 'outside', padding: 3 } },
            ],
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Funnel
// ============================================

function buildFunnelOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const categoryEncoding = config.encodings.find(e => e.channel === 'x');
    const valueEncoding = config.encodings.find(e => e.channel === 'y');
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    const funnelData = data.map(d => ({
        name: String(d[categoryField]),
        value: Number(d[valueField]) || 0,
    })).sort((a, b) => b.value - a.value);

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'item', formatter: '{b}: {c}', ...TOOLTIP_STYLE },
        legend: { top: 10, textStyle: { color: '#d4d4d8' } },
        series: [{
            type: 'funnel',
            left: '10%',
            right: '10%',
            top: 60,
            bottom: 20,
            width: '80%',
            minSize: '0%',
            maxSize: '100%',
            sort: 'descending',
            gap: 2,
            label: { show: true, position: 'inside', color: '#fff' },
            itemStyle: { borderColor: '#18181b', borderWidth: 1 },
            emphasis: { label: { fontSize: 16 } },
            data: funnelData,
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Gauge
// ============================================

function buildGaugeOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const valueEncoding = config.encodings.find(e => e.channel === 'y') ||
        config.encodings.find(e => e.channel === 'x');
    const valueField = valueEncoding?.field.name || '';

    // Use first value or average
    const values = data.map(d => Number(d[valueField]) || 0);
    const value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const max = Math.max(...values) * 1.2 || 100;

    return {
        backgroundColor: 'transparent',
        title: buildTitleOption(config.title),
        tooltip: { formatter: '{b}: {c}', ...TOOLTIP_STYLE },
        series: [{
            type: 'gauge',
            radius: '80%',
            min: 0,
            max: Math.round(max),
            progress: { show: true, width: 18 },
            axisLine: { lineStyle: { width: 18, color: [[0.3, '#ef4444'], [0.7, '#f59e0b'], [1, '#10b981']] } },
            axisTick: { show: false },
            splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
            axisLabel: { distance: 25, color: '#a1a1aa', fontSize: 12 },
            anchor: { show: true, size: 25, itemStyle: { borderWidth: 10 } },
            pointer: { itemStyle: { color: '#3b82f6' } },
            detail: {
                valueAnimation: true,
                fontSize: 32,
                color: '#fafafa',
                formatter: '{value}',
                offsetCenter: [0, '70%'],
            },
            data: [{ value: Math.round(value), name: valueField }],
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Sankey
// ============================================

function buildSankeyOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const sourceEncoding = config.encodings.find(e => e.channel === 'x');
    const targetEncoding = config.encodings.find(e => e.channel === 'y');
    const valueEncoding = config.encodings.find(e => e.channel === 'size') ||
        config.encodings.find(e => e.channel === 'color');

    const sourceField = sourceEncoding?.field.name || '';
    const targetField = targetEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    const nodesSet = new Set<string>();
    const links = data.map(d => {
        const source = String(d[sourceField]);
        const target = String(d[targetField]);
        nodesSet.add(source);
        nodesSet.add(target);
        return {
            source,
            target,
            value: valueField ? Number(d[valueField]) || 1 : 1,
        };
    });

    const nodes = Array.from(nodesSet).map(name => ({ name }));

    return {
        backgroundColor: 'transparent',
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'item', ...TOOLTIP_STYLE },
        series: [{
            type: 'sankey',
            data: nodes,
            links,
            emphasis: { focus: 'adjacency' },
            lineStyle: { color: 'gradient', curveness: 0.5 },
            label: { color: '#d4d4d8' },
            itemStyle: { borderWidth: 1, borderColor: '#18181b' },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Boxplot
// ============================================

function buildBoxplotOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const categoryEncoding = config.encodings.find(e => e.channel === 'x');
    const valueEncoding = config.encodings.find(e => e.channel === 'y');
    const categoryField = categoryEncoding?.field.name || '';
    const valueField = valueEncoding?.field.name || '';

    // Group values by category
    const groups = new Map<string, number[]>();
    for (const row of data) {
        const cat = String(row[categoryField]);
        const val = Number(row[valueField]) || 0;
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(val);
    }

    const categories = Array.from(groups.keys());
    const boxData = categories.map(cat => {
        const values = groups.get(cat)!.sort((a, b) => a - b);
        const min = values[0];
        const max = values[values.length - 1];
        const q1 = values[Math.floor(values.length * 0.25)];
        const q2 = values[Math.floor(values.length * 0.5)];
        const q3 = values[Math.floor(values.length * 0.75)];
        return [min, q1, q2, q3, max];
    });

    return {
        backgroundColor: 'transparent',
        color: DEFAULT_COLORS,
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'item', ...TOOLTIP_STYLE },
        xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { color: '#a1a1aa' },
            axisLine: { lineStyle: { color: '#3f3f46' } },
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#a1a1aa' },
            axisLine: { lineStyle: { color: '#3f3f46' } },
            splitLine: { lineStyle: { color: '#27272a' } },
        },
        series: [{
            type: 'boxplot',
            data: boxData,
            itemStyle: { color: '#3b82f6', borderColor: '#60a5fa' },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Candlestick (OHLC)
// ============================================

function buildCandlestickOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    // Expects fields: date/category, open, close, low, high
    const xEncoding = config.encodings.find(e => e.channel === 'x');
    const xField = xEncoding?.field.name || '';

    const categories = data.map(d => String(d[xField]));

    // Try to find OHLC fields
    const ohlcData = data.map(d => [
        Number(d['open']) || Number(d['Open']) || 0,
        Number(d['close']) || Number(d['Close']) || 0,
        Number(d['low']) || Number(d['Low']) || 0,
        Number(d['high']) || Number(d['High']) || 0,
    ]);

    return {
        backgroundColor: 'transparent',
        title: buildTitleOption(config.title),
        tooltip: { trigger: 'axis', ...TOOLTIP_STYLE },
        xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { color: '#a1a1aa' },
            axisLine: { lineStyle: { color: '#3f3f46' } },
        },
        yAxis: {
            type: 'value',
            scale: true,
            axisLabel: { color: '#a1a1aa' },
            axisLine: { lineStyle: { color: '#3f3f46' } },
            splitLine: { lineStyle: { color: '#27272a' } },
        },
        series: [{
            type: 'candlestick',
            data: ohlcData,
            itemStyle: {
                color: '#10b981',
                color0: '#ef4444',
                borderColor: '#10b981',
                borderColor0: '#ef4444',
            },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Graph (Network)
// ============================================

function buildGraphOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const sourceEncoding = config.encodings.find(e => e.channel === 'x');
    const targetEncoding = config.encodings.find(e => e.channel === 'y');
    const sourceField = sourceEncoding?.field.name || '';
    const targetField = targetEncoding?.field.name || '';

    const nodesSet = new Set<string>();
    const links = data.map(d => {
        const source = String(d[sourceField]);
        const target = String(d[targetField]);
        nodesSet.add(source);
        nodesSet.add(target);
        return { source, target };
    });

    const nodes = Array.from(nodesSet).map((name, i) => ({
        name,
        symbolSize: 30,
        itemStyle: { color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
    }));

    return {
        backgroundColor: 'transparent',
        title: buildTitleOption(config.title),
        tooltip: { ...TOOLTIP_STYLE },
        series: [{
            type: 'graph',
            layout: 'force',
            data: nodes,
            links,
            roam: true,
            label: { show: true, position: 'right', color: '#d4d4d8' },
            force: { repulsion: 100, edgeLength: 100 },
            lineStyle: { color: 'source', curveness: 0.3 },
            emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        }],
        toolbox: TOOLBOX,
    };
}

// ============================================
// Data Processing Utilities
// ============================================

function processDataWithAggregation(data: DataRecord[], encodings: ShelfPlacement[]): DataRecord[] {
    const aggregations = encodings.filter(e => e.aggregate);
    if (aggregations.length === 0) return data;

    const groupByFields = encodings
        .filter(e => !e.aggregate && e.channel !== 'tooltip')
        .map(e => e.field.name);

    if (groupByFields.length === 0) return data;

    const groups = new Map<string, DataRecord[]>();
    for (const row of data) {
        const key = groupByFields.map(f => String(row[f])).join('|||');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
    }

    return Array.from(groups.entries()).map(([key, rows]) => {
        const result: DataRecord = {};
        const keyParts = key.split('|||');
        groupByFields.forEach((field, i) => { result[field] = keyParts[i]; });

        for (const encoding of aggregations) {
            const fieldName = encoding.field.name;
            const values = rows.map(r => Number(r[fieldName]) || 0);

            switch (encoding.aggregate) {
                case 'sum': result[fieldName] = values.reduce((a, b) => a + b, 0); break;
                case 'mean': result[fieldName] = values.reduce((a, b) => a + b, 0) / values.length; break;
                case 'count': result[fieldName] = rows.length; break;
                case 'min': result[fieldName] = Math.min(...values); break;
                case 'max': result[fieldName] = Math.max(...values); break;
                case 'median':
                    const sorted = [...values].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    result[fieldName] = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                    break;
                case 'distinct': result[fieldName] = new Set(rows.map(r => r[fieldName])).size; break;
                default: result[fieldName] = values[0];
            }
        }
        return result;
    });
}

function formatAxisTitle(placement: ShelfPlacement): string {
    if (placement.aggregate) {
        const aggLabel = placement.aggregate.charAt(0).toUpperCase() + placement.aggregate.slice(1);
        return `${aggLabel} of ${placement.field.name}`;
    }
    return placement.field.name;
}

// ============================================
// Histogram
// ============================================

function buildHistogramOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEnc = config.encodings.find(e => e.channel === 'x');

    if (!xEnc) {
        return { ...buildTitleOption(config.title), tooltip: TOOLTIP_STYLE };
    }

    const values = data.map(d => Number(d[xEnc.field.name])).filter(v => !isNaN(v));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 10;
    const binWidth = (max - min) / binCount;

    const bins: number[] = Array(binCount).fill(0);
    values.forEach(v => {
        const binIndex = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
        bins[binIndex]++;
    });

    const categories = bins.map((_, i) => `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`);

    return {
        ...buildTitleOption(config.title),
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#a1a1aa', rotate: 45, fontSize: 10 } },
        yAxis: { type: 'value', name: 'Frequency', axisLabel: { color: '#a1a1aa' } },
        series: [{ type: 'bar', data: bins, itemStyle: { color: '#3b82f6' } }],
        grid: { left: '10%', right: '10%', bottom: '20%', top: 60 },
    };
}

// ============================================
// Tree (Hierarchical)
// ============================================

function buildTreeOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEnc = config.encodings.find(e => e.channel === 'x');
    const yEnc = config.encodings.find(e => e.channel === 'y');

    // Build a simple tree from first two fields
    const categoryField = xEnc?.field.name || Object.keys(data[0] || {})[0];

    const grouped: Record<string, DataRecord[]> = {};
    data.forEach(d => {
        const key = String(d[categoryField]);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d);
    });

    const treeData = {
        name: config.title || 'Root',
        children: Object.entries(grouped).slice(0, 10).map(([name, items]) => ({
            name,
            value: items.length,
            children: items.slice(0, 5).map((item, i) => ({
                name: yEnc ? String(item[yEnc.field.name]) : `Item ${i + 1}`,
                value: 1
            }))
        }))
    };

    return {
        ...buildTitleOption(config.title),
        tooltip: TOOLTIP_STYLE,
        series: [{
            type: 'tree',
            data: [treeData],
            top: '10%',
            left: '10%',
            bottom: '10%',
            right: '20%',
            symbolSize: 10,
            label: { position: 'left', color: '#a1a1aa', fontSize: 11 },
            leaves: { label: { position: 'right' } },
            lineStyle: { color: '#4b5563', width: 1, curveness: 0.5 }
        }]
    };
}

// ============================================
// Parallel Coordinates
// ============================================

function buildParallelOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    // Find all numeric fields
    const numericFields = Object.keys(data[0] || {}).filter(key =>
        typeof data[0][key] === 'number' || !isNaN(Number(data[0][key]))
    ).slice(0, 6);

    if (numericFields.length < 2) {
        return { ...buildTitleOption(config.title), tooltip: TOOLTIP_STYLE };
    }

    const parallelAxis = numericFields.map((name, dim) => ({
        dim,
        name,
        nameTextStyle: { color: '#a1a1aa', fontSize: 10 },
        axisLine: { lineStyle: { color: '#4b5563' } },
        axisLabel: { color: '#a1a1aa' }
    }));

    const seriesData = data.slice(0, 100).map(d =>
        numericFields.map(f => Number(d[f]) || 0)
    );

    return {
        ...buildTitleOption(config.title),
        tooltip: TOOLTIP_STYLE,
        parallelAxis,
        parallel: { left: '10%', right: '10%', bottom: '15%', top: 60, parallelAxisDefault: { nameLocation: 'end' } },
        series: [{
            type: 'parallel',
            lineStyle: { width: 1, opacity: 0.4 },
            data: seriesData
        }]
    };
}

// ============================================
// Waterfall Chart
// ============================================

function buildWaterfallOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEnc = config.encodings.find(e => e.channel === 'x');
    const yEnc = config.encodings.find(e => e.channel === 'y');

    if (!xEnc || !yEnc) {
        return { ...buildTitleOption(config.title), tooltip: TOOLTIP_STYLE };
    }

    const categories = data.slice(0, 15).map(d => String(d[xEnc.field.name]));
    const values = data.slice(0, 15).map(d => Number(d[yEnc.field.name]) || 0);

    // Calculate running totals for waterfall
    const base: (number | '-')[] = [];
    const positives: (number | '-')[] = [];
    const negatives: (number | '-')[] = [];
    let runningTotal = 0;

    values.forEach((val, i) => {
        if (i === 0) {
            base.push(0);
            positives.push(val);
            negatives.push('-');
            runningTotal = val;
        } else {
            if (val >= 0) {
                base.push(runningTotal);
                positives.push(val);
                negatives.push('-');
            } else {
                base.push(runningTotal + val);
                positives.push('-');
                negatives.push(Math.abs(val));
            }
            runningTotal += val;
        }
    });

    return {
        ...buildTitleOption(config.title),
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
        legend: { show: false },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#a1a1aa', rotate: 45 } },
        yAxis: { type: 'value', axisLabel: { color: '#a1a1aa' } },
        series: [
            { type: 'bar', stack: 'waterfall', data: base, itemStyle: { color: 'transparent' } },
            { type: 'bar', stack: 'waterfall', data: positives, itemStyle: { color: '#10b981' }, name: 'Increase' },
            { type: 'bar', stack: 'waterfall', data: negatives, itemStyle: { color: '#ef4444' }, name: 'Decrease' }
        ],
        grid: { left: '10%', right: '10%', bottom: '20%', top: 60 }
    };
}

// ============================================
// Calendar Heatmap
// ============================================

function buildCalendarOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEnc = config.encodings.find(e => e.channel === 'x');
    const yEnc = config.encodings.find(e => e.channel === 'y');

    // Generate sample calendar data if no date field
    const year = new Date().getFullYear();
    const calendarData: [string, number][] = [];

    if (xEnc && yEnc) {
        data.forEach(d => {
            const dateStr = String(d[xEnc.field.name]);
            const value = Number(d[yEnc.field.name]) || 0;
            calendarData.push([dateStr, value]);
        });
    } else {
        // Generate sample data for current year
        for (let i = 0; i < 365; i++) {
            const date = new Date(year, 0, i + 1);
            const dateStr = date.toISOString().split('T')[0];
            calendarData.push([dateStr, Math.floor(Math.random() * 100)]);
        }
    }

    const values = calendarData.map(d => d[1]);
    const maxValue = Math.max(...values, 1);

    return {
        ...buildTitleOption(config.title),
        tooltip: {
            ...TOOLTIP_STYLE, formatter: (params: unknown) => {
                const p = params as { data: [string, number] };
                return `${p.data[0]}: ${p.data[1]}`;
            }
        },
        visualMap: {
            min: 0, max: maxValue, calculable: true, orient: 'horizontal', left: 'center', bottom: 15,
            inRange: { color: ['#1e3a5f', '#3b82f6', '#60a5fa', '#93c5fd'] },
            textStyle: { color: '#a1a1aa' }
        },
        calendar: {
            top: 80, left: 30, right: 30, cellSize: ['auto', 15],
            range: String(year),
            itemStyle: { borderWidth: 0.5, borderColor: '#1f2937' },
            yearLabel: { show: true, color: '#a1a1aa' },
            dayLabel: { color: '#a1a1aa', fontSize: 10 },
            monthLabel: { color: '#a1a1aa', fontSize: 10 }
        },
        series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calendarData }]
    };
}

// ============================================
// Pictorial Bar
// ============================================

function buildPictorialBarOption(config: ChartConfig, data: DataRecord[]): EChartsOption {
    const xEnc = config.encodings.find(e => e.channel === 'x');
    const yEnc = config.encodings.find(e => e.channel === 'y');

    if (!xEnc || !yEnc) {
        return { ...buildTitleOption(config.title), tooltip: TOOLTIP_STYLE };
    }

    const chartData = data.slice(0, 10).map(d => ({
        name: String(d[xEnc.field.name]),
        value: Number(d[yEnc.field.name]) || 0
    }));

    return {
        ...buildTitleOption(config.title),
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
        xAxis: {
            type: 'category',
            data: chartData.map(d => d.name),
            axisLabel: { color: '#a1a1aa', rotate: 45 }
        },
        yAxis: { type: 'value', axisLabel: { color: '#a1a1aa' } },
        series: [{
            type: 'pictorialBar',
            symbol: 'rect',
            symbolRepeat: true,
            symbolSize: ['80%', 8],
            symbolMargin: 2,
            data: chartData.map(d => d.value),
            itemStyle: { color: '#3b82f6' },
            label: { show: true, position: 'top', color: '#a1a1aa', fontSize: 10 }
        }],
        grid: { left: '10%', right: '10%', bottom: '20%', top: 60 }
    };
}
