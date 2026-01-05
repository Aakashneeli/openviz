// ============================================
// DashboardGrid - Cinematic Multi-Chart Display
// ============================================

import { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';
import { X, Maximize2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardSummaryPanel } from '@/components/canvas/DashboardSummaryPanel';
import { useVizStore, selectDashboardConfig, selectDataset, selectDashboardSummary, selectSummaryLoading } from '@/store/useVizStore';
import { buildVegaLiteSpec } from '@/utils/vegaSpecBuilder';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ChartConfig } from '@/types';

interface DashboardChartProps {
    config: ChartConfig;
    data: Record<string, unknown>[];
    onExpand?: () => void;
    isFocused: boolean;
    isBlur: boolean;
    onHover: (id: string | null) => void;
}

function DashboardChart({ config, data, onExpand, isFocused, isBlur, onHover }: DashboardChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !config.encodings.length) return;

        const renderChart = async () => {
            try {
                const spec = buildVegaLiteSpec(config, data);

                // Modify spec for dashboard display
                const dashboardSpec = {
                    ...spec,
                    width: 280,
                    height: 200,
                    background: 'transparent',
                    config: {
                        background: 'transparent',
                        view: { stroke: 'transparent' },
                        axis: {
                            labelColor: '#94a3b8',
                            titleColor: '#e2e8f0',
                            gridColor: 'rgba(255,255,255,0.05)',
                            domainColor: 'rgba(255,255,255,0.1)',
                            labelFontSize: 9,
                            titleFontSize: 10,
                            labelFont: 'Geist Sans, sans-serif',
                            titleFont: 'Geist Sans, sans-serif',
                        },
                        legend: {
                            labelColor: '#cbd5e1',
                            titleColor: '#f8fafc',
                            labelFontSize: 9,
                            labelFont: 'Geist Sans, sans-serif',
                        },
                        title: {
                            color: '#f8fafc',
                            fontSize: 12,
                            fontWeight: 600,
                            font: 'Geist Sans, sans-serif',
                        },
                    },
                };

                await embed(containerRef.current!, dashboardSpec as never, {
                    actions: false,
                    renderer: 'svg',
                    tooltip: { theme: 'dark' },
                });
            } catch (err) {
                console.error('Dashboard chart render error:', err);
            }
        };

        renderChart();

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, [config, data]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
                opacity: isBlur ? 0.3 : 1,
                scale: isFocused ? 1.02 : 1,
                filter: isBlur ? 'blur(2px)' : 'blur(0px)'
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden group hover:border-indigo-500/50 hover:bg-white/10 transition-colors shadow-lg",
                isFocused && "z-10 shadow-indigo-500/20 border-indigo-500/40"
            )}
            onMouseEnter={() => onHover(config.id)}
            onMouseLeave={() => onHover(null)}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/20">
                <h3 className="text-xs font-medium text-slate-200 truncate flex items-center gap-2">
                    <Activity className="w-3 h-3 text-indigo-400" />
                    {config.title || `${config.mark} Chart`}
                </h3>
                {onExpand && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={onExpand}
                    >
                        <Maximize2 className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Chart */}
            <div className="p-2">
                {config.encodings.length > 0 ? (
                    <div ref={containerRef} />
                ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground/50 animate-pulse">
                        Configuring...
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function GhostSkeleton() {
    return (
        <div className="bg-white/5 rounded-xl border border-white/5 h-[240px] animate-pulse relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <div className="h-8 border-b border-white/5 bg-white/5 mx-0" />
            <div className="p-4 space-y-3">
                <div className="h-32 bg-white/5 rounded-md w-full" />
                <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
        </div>
    );
}

export function DashboardGrid() {
    const dashboard = useVizStore(selectDashboardConfig);
    const dataset = useVizStore(selectDataset);
    const dashboardSummary = useVizStore(selectDashboardSummary);
    const summaryLoading = useVizStore(selectSummaryLoading);
    const { setViewMode, setDashboardConfig, generateDashboardSummary } = useVizStore();
    const [hoveredChart, setHoveredChart] = useState<string | null>(null);

    // Simulated Loading State for "Ghost" effect on mount
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    if (!dashboard || !dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                    <Activity className="w-8 h-8 text-indigo-500/50" />
                </div>
                <p className="text-sm">No dashboard active</p>
            </div>
        );
    }

    const handleClose = () => {
        setViewMode('single');
        setDashboardConfig(null);
    };

    const handleExpandChart = (chart: ChartConfig) => {
        useVizStore.setState({
            chartConfig: chart,
            encodings: chart.encodings,
            chartSummary: null,
            aiInsights: []
        });
        useVizStore.getState().regenerateSpec();
        setViewMode('single');
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 backdrop-blur-md z-20">
                <div>
                    <h2 className="font-semibold text-slate-100 text-sm tracking-wide">{dashboard.title}</h2>
                    <p className="text-[10px] text-indigo-400 font-mono mt-0.5">{dashboard.charts.length} VISUALIZATIONS</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                {/* Dashboard Summary Panel */}
                <DashboardSummaryPanel
                    summary={dashboardSummary}
                    isLoading={summaryLoading}
                    onGenerate={generateDashboardSummary}
                />

                <LayoutGroup>
                    <div
                        className="grid gap-4 mt-4"
                        style={{
                            gridTemplateColumns: `repeat(${dashboard.layout.cols}, 1fr)`,
                        }}
                    >
                        <AnimatePresence mode='popLayout'>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <motion.div
                                        key={`skeleton-${i}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <GhostSkeleton />
                                    </motion.div>
                                ))
                            ) : (
                                dashboard.charts.map((chart) => (
                                    <DashboardChart
                                        key={chart.id}
                                        config={chart}
                                        data={dataset.data}
                                        onExpand={() => handleExpandChart(chart)}
                                        onHover={setHoveredChart}
                                        isFocused={!hoveredChart || hoveredChart === chart.id}
                                        isBlur={!!hoveredChart && hoveredChart !== chart.id}
                                    />
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </LayoutGroup>
            </div>
        </div>
    );
}
