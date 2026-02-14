// ============================================
// VizPreview - ECharts Interactive Chart
// With Drill-Down Navigation Support
// ============================================

import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, MousePointer2, Move, ZoomIn, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartSummaryCard } from '@/components/canvas/ChartSummaryCard';
import { DrillBreadcrumb } from '@/components/canvas/DrillBreadcrumb';
import { useVizStore, selectEChartsOption, selectDataset, selectEncodings, selectChartSummary, selectSummaryLoading, selectDrillPath, selectDrillHierarchies } from '@/store/useVizStore';
import { getCurrentDrillLevel, canDrillDeeper } from '@backend/services/drillService';


interface VizPreviewProps {
    minWidth?: number;
    minHeight?: number;
}

export function VizPreview({ minWidth = 600, minHeight = 400 }: VizPreviewProps) {
    const echartsOption = useVizStore(selectEChartsOption);
    const dataset = useVizStore(selectDataset);
    const encodings = useVizStore(selectEncodings);
    const chartSummary = useVizStore(selectChartSummary);
    const summaryLoading = useVizStore(selectSummaryLoading);
    const drillPath = useVizStore(selectDrillPath);
    const drillHierarchies = useVizStore(selectDrillHierarchies);
    const { generateChartSummary, drillDown } = useVizStore();

    // Determine if drill-down is available for the current chart
    const drillInfo = useMemo(() => {
        if (!dataset || drillHierarchies.length === 0) return null;

        // Check if x-axis has a temporal field with a hierarchy
        const xEncoding = encodings.find(e => e.channel === 'x');
        if (!xEncoding) return null;

        const hierarchy = drillHierarchies.find(h => h.sourceField === xEncoding.field.name);
        if (!hierarchy || hierarchy.type !== 'temporal') return null;

        const currentLevel = getCurrentDrillLevel(drillPath, hierarchy.availableLevels);
        const canGoDeeper = canDrillDeeper(drillPath, hierarchy.availableLevels);

        return {
            hierarchy,
            currentLevel,
            canGoDeeper,
            field: xEncoding.field.name,
        };
    }, [dataset, drillHierarchies, encodings, drillPath]);

    // Handle chart click for drill-down
    const handleChartClick = useCallback((params: { name?: string; value?: unknown; componentType?: string }) => {
        if (!drillInfo || !drillInfo.canGoDeeper) return;
        if (!params.name) return;

        drillDown(drillInfo.field, params.name, drillInfo.currentLevel);
    }, [drillInfo, drillDown]);

    const onEvents = useMemo((): Record<string, Function> | undefined => {
        if (!drillInfo?.canGoDeeper) return undefined;
        return { click: handleChartClick };
    }, [drillInfo, handleChartClick]);

    // Calculate dynamic size based on data
    const chartSize = useMemo(() => {
        if (!dataset || !encodings.length) return { width: minWidth, height: minHeight };

        // Get unique values for categorical axes to determine size
        const xEncoding = encodings.find(e => e.channel === 'x');
        const yEncoding = encodings.find(e => e.channel === 'y');

        let width = minWidth;
        let height = minHeight;

        // If x-axis is categorical, scale width based on unique values
        if (xEncoding && (xEncoding.field.type === 'nominal' || xEncoding.field.type === 'ordinal')) {
            const uniqueCount = xEncoding.field.stats.uniqueCount || 10;
            width = Math.max(minWidth, uniqueCount * 40); // 40px per category
        }

        // If y-axis is categorical, scale height based on unique values
        if (yEncoding && (yEncoding.field.type === 'nominal' || yEncoding.field.type === 'ordinal')) {
            const uniqueCount = yEncoding.field.stats.uniqueCount || 10;
            height = Math.max(minHeight, uniqueCount * 30); // 30px per category
        }

        // Cap at reasonable maximums
        return {
            width: Math.min(width, 2000),
            height: Math.min(height, 1500)
        };
    }, [dataset, encodings, minWidth, minHeight]);

    // Generate a unique key based on encodings + drill path to force chart remount
    const chartKey = useMemo(() => {
        const encKey = encodings.map(e => `${e.channel}:${e.field.name}`).join('|');
        const drillKey = drillPath.map(d => `${d.level}:${d.value}`).join('/');
        return `${encKey}#${drillKey}`;
    }, [encodings, drillPath]);

    if (!dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <BarChart3 className="w-9 h-9 text-indigo-400" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-2">Ready to Visualize</p>
                <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
                    Upload a dataset from the left panel to start creating beautiful charts and dashboards.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <span className="px-2 py-1 bg-muted/30 rounded">1. Upload data</span>
                    <span className="text-muted-foreground/30">→</span>
                    <span className="px-2 py-1 bg-muted/30 rounded">2. Drag fields</span>
                    <span className="text-muted-foreground/30">→</span>
                    <span className="px-2 py-1 bg-muted/30 rounded">3. See charts</span>
                </div>
            </div>
        );
    }

    if (!echartsOption) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <div className="w-full max-w-md p-8 rounded-2xl border-2 border-dashed border-indigo-500/20 bg-indigo-500/5 text-center hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <MousePointer2 className="w-7 h-7 text-indigo-400" />
                    </div>
                    <p className="text-base font-medium text-foreground mb-2">Drag Fields to Build Your Chart</p>
                    <p className="text-sm text-muted-foreground mb-6">
                        Drag fields from the left panel onto the encoding channels on the right.
                    </p>
                    <div className="flex justify-center items-center gap-4 text-xs">
                        <div className="flex flex-col items-center gap-1">
                            <span className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-300 font-medium">X-Axis</span>
                            <span className="text-muted-foreground/50 text-[10px]">Categories or Time</span>
                        </div>
                        <span className="text-indigo-400">+</span>
                        <div className="flex flex-col items-center gap-1">
                            <span className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 font-medium">Y-Axis</span>
                            <span className="text-muted-foreground/50 text-[10px]">Values or Measures</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Interaction hints */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/20 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    <span className="flex items-center gap-1.5">
                        <MousePointer2 className="w-3 h-3 text-primary" /> Hover for values
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Move className="w-3 h-3 text-primary" /> Scroll to explore
                    </span>
                    <span className="flex items-center gap-1.5">
                        <ZoomIn className="w-3 h-3 text-primary" /> Pinch to zoom
                    </span>
                    {drillInfo && (
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <Layers className="w-3 h-3" /> {drillInfo.canGoDeeper ? 'Click to drill down' : 'Deepest level'}
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded">
                    {chartSize.width} × {chartSize.height}px
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={generateChartSummary}
                    disabled={summaryLoading || encodings.length === 0}
                    className="h-6 text-[10px] gap-1.5 bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 hover:border-indigo-500/40 transition-all shadow-[0_0_10px_rgba(99,102,241,0.1)] hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                >
                    <Sparkles className="h-3 w-3" />
                    {summaryLoading ? 'Generating...' : 'Summarize'}
                </Button>
            </div>

            {/* Drill-Down Breadcrumb */}
            {drillPath.length > 0 && (
                <div className="px-4 py-2 border-b border-border bg-card/10">
                    <DrillBreadcrumb />
                </div>
            )}

            {/* Scrollable chart container */}
            <div className="flex-1 overflow-auto p-8 relative">
                {/* Chart Background Grid (Optional enhancement) */}
                <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] opacity-20 pointer-events-none" />

                <div
                    className={`relative z-0 ${drillInfo?.canGoDeeper ? 'cursor-pointer' : ''}`}
                    style={{ width: chartSize.width, height: chartSize.height }}
                >
                    <ReactECharts
                        key={chartKey}
                        option={echartsOption}
                        style={{ width: chartSize.width, height: chartSize.height }}
                        notMerge={true}
                        lazyUpdate={false}
                        opts={{ renderer: 'canvas' }}
                        onEvents={onEvents}
                    />
                </div>

                {/* Chart Summary Card */}
                <div className="max-w-2xl mx-auto">
                    <ChartSummaryCard
                        summary={chartSummary}
                        isLoading={summaryLoading}
                        onGenerate={generateChartSummary}
                    />
                </div>
            </div>
        </div>
    );
}
