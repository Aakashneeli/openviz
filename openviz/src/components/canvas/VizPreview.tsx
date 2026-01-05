// ============================================
// VizPreview - Scrollable Interactive Chart
// ============================================

import { useEffect, useRef, useMemo } from 'react';
import embed from 'vega-embed';
import { BarChart3, MousePointer2, Move, ZoomIn, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartSummaryCard } from '@/components/canvas/ChartSummaryCard';
import { useVizStore, selectVegaSpec, selectDataset, selectEncodings, selectChartSummary, selectSummaryLoading } from '@/store/useVizStore';

interface VizPreviewProps {
    minWidth?: number;
    minHeight?: number;
}

export function VizPreview({ minWidth = 600, minHeight = 400 }: VizPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const vegaSpec = useVizStore(selectVegaSpec);
    const dataset = useVizStore(selectDataset);
    const encodings = useVizStore(selectEncodings);
    const chartSummary = useVizStore(selectChartSummary);
    const summaryLoading = useVizStore(selectSummaryLoading);
    const { generateChartSummary } = useVizStore();

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

    // Prepare spec with interactive features
    const spec = useMemo(() => {
        if (!vegaSpec) return null;

        return {
            ...vegaSpec,
            width: chartSize.width,
            height: chartSize.height,
            background: 'transparent',
            autosize: { type: 'fit', contains: 'padding' },

            // Interactive selection
            params: [
                {
                    name: 'hover',
                    select: { type: 'point', on: 'pointerover', clear: 'pointerout' }
                }
            ],

            config: {
                background: 'transparent',
                view: { stroke: 'transparent' },
                axis: {
                    labelFont: 'Outfit, sans-serif',
                    titleFont: 'Outfit, sans-serif',
                    labelColor: '#a1a1aa', // zinc-400
                    titleColor: '#e4e4e7', // zinc-200
                    gridColor: '#27272a',  // zinc-800
                    domainColor: '#3f3f46', // zinc-700
                    labelFontSize: 11,
                    titleFontSize: 12,
                    titleFontWeight: 600,
                },
                legend: {
                    labelFont: 'Outfit, sans-serif',
                    titleFont: 'Outfit, sans-serif',
                    labelColor: '#d4d4d8', // zinc-300
                    titleColor: '#fafafa', // zinc-50
                },
                title: {
                    font: 'Outfit, sans-serif',
                    color: '#fafafa',
                    fontSize: 16,
                    fontWeight: 600,
                },
                range: {
                    category: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                        '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
                    ]
                }
            },
        };
    }, [vegaSpec, chartSize]);

    useEffect(() => {
        if (!containerRef.current || !spec) return;

        const embedChart = async () => {
            try {
                await embed(containerRef.current!, spec as never, {
                    actions: { export: true, source: false, compiled: false, editor: false },
                    renderer: 'svg',
                    tooltip: { theme: 'dark' },
                });
            } catch (err) {
                console.error('Vega embed error:', err);
            }
        };

        embedChart();

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, [spec]);

    if (!dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-border flex items-center justify-center shadow-2xl shadow-primary/5">
                    <BarChart3 className="w-10 h-10 text-primary/60" />
                </div>
                <p className="text-xl font-medium text-foreground mb-2">No Data Loaded</p>
                <p className="text-sm text-muted-foreground">Upload a CSV or JSON file to start visualizing</p>
            </div>
        );
    }

    if (!spec) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div className="w-full max-w-sm p-8 rounded-2xl border-2 border-dashed border-border bg-card/10 text-center hover:border-primary/20 transition-colors">
                    <p className="text-sm text-muted-foreground mb-4">Drag fields to create your chart</p>
                    <div className="flex justify-center gap-6 text-xs text-muted-foreground/60">
                        <span className="bg-secondary/50 px-2 py-1 rounded">X-Axis</span>
                        <span className="opacity-30">→</span>
                        <span className="bg-secondary/50 px-2 py-1 rounded">Y-Axis</span>
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

            {/* Scrollable chart container */}
            <div className="flex-1 overflow-auto p-8 relative">
                {/* Chart Background Grid (Optional enhancement) */}
                <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] opacity-20 pointer-events-none" />

                <div
                    ref={containerRef}
                    className="inline-block relative z-0"
                    style={{ minWidth: chartSize.width, minHeight: chartSize.height }}
                />

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
