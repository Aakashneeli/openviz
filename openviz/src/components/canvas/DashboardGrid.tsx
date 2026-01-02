// ============================================
// DashboardGrid - Multi-Chart Display
// ============================================

import { useEffect, useRef } from 'react';
import embed from 'vega-embed';
import { X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectDashboardConfig, selectDataset } from '@/store/useVizStore';
import { buildVegaLiteSpec } from '@/utils/vegaSpecBuilder';
import type { ChartConfig } from '@/types';

interface DashboardChartProps {
    config: ChartConfig;
    data: Record<string, unknown>[];
    onExpand?: () => void;
}

function DashboardChart({ config, data, onExpand }: DashboardChartProps) {
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
                            labelColor: '#a1a1aa',
                            titleColor: '#e4e4e7',
                            gridColor: '#27272a',
                            domainColor: '#3f3f46',
                            labelFontSize: 9,
                            titleFontSize: 10,
                        },
                        legend: {
                            labelColor: '#d4d4d8',
                            titleColor: '#fafafa',
                            labelFontSize: 9,
                        },
                        title: {
                            color: '#fafafa',
                            fontSize: 12,
                            fontWeight: 600,
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
        <div className="relative bg-card rounded-lg border border-border overflow-hidden group hover:border-primary/50 transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-muted/30">
                <h3 className="text-xs font-medium text-foreground truncate">
                    {config.title || `${config.mark} Chart`}
                </h3>
                {onExpand && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
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
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground/50">
                        No encodings configured
                    </div>
                )}
            </div>
        </div>
    );
}

export function DashboardGrid() {
    const dashboard = useVizStore(selectDashboardConfig);
    const dataset = useVizStore(selectDataset);
    const { setViewMode, setDashboardConfig } = useVizStore();

    if (!dashboard || !dataset) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No dashboard configured</p>
            </div>
        );
    }

    const handleClose = () => {
        setViewMode('single');
        setDashboardConfig(null);
    };

    const handleExpandChart = (chart: ChartConfig) => {
        // Set this chart as the current chart and switch to single view
        useVizStore.getState().setMark(chart.mark);
        if (chart.encodings.length > 0) {
            // Apply first chart's encodings
            useVizStore.setState({ encodings: chart.encodings });
            useVizStore.getState().regenerateSpec();
        }
        setViewMode('single');
    };

    return (
        <div className="flex flex-col h-full bg-background/50">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
                <div>
                    <h2 className="font-semibold text-foreground text-sm">{dashboard.title}</h2>
                    <p className="text-xs text-muted-foreground">{dashboard.charts.length} charts</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 overflow-auto">
                <div
                    className="grid gap-4"
                    style={{
                        gridTemplateColumns: `repeat(${dashboard.layout.cols}, 1fr)`,
                    }}
                >
                    {dashboard.charts.map((chart) => (
                        <DashboardChart
                            key={chart.id}
                            config={chart}
                            data={dataset.data}
                            onExpand={() => handleExpandChart(chart)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
