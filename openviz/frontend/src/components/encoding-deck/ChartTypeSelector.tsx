// ============================================
// ChartTypeSelector - Advanced Chart Type Picker
// ============================================

import {
    BarChart3,
    LineChart,
    ScatterChart,
    PieChart,
    Activity,
    Target,
    Grid3X3,
    Sun,
    GitBranch,
    Gauge,
    TrendingDown,
    BoxSelect,
    CandlestickChart,
    Network,
    Flame,
    GitGraph,
    BarChart,
    Calendar,
    Layers,
    Workflow
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVizStore } from '@/store/useVizStore';
import type { MarkType } from '@backend/types';

interface ChartTypeOption {
    value: MarkType;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const CHART_GROUPS: { title: string; charts: ChartTypeOption[] }[] = [
    {
        title: 'Basic',
        charts: [
            { value: 'auto', label: 'Auto', icon: <Activity className="w-4 h-4" />, description: 'Smart detection' },
            { value: 'bar', label: 'Bar', icon: <BarChart3 className="w-4 h-4" />, description: 'Compare values' },
            { value: 'line', label: 'Line', icon: <LineChart className="w-4 h-4" />, description: 'Trends over time' },
            { value: 'point', label: 'Scatter', icon: <ScatterChart className="w-4 h-4" />, description: 'Correlations' },
            { value: 'area', label: 'Area', icon: <Flame className="w-4 h-4" />, description: 'Filled trends' },
            { value: 'arc', label: 'Pie', icon: <PieChart className="w-4 h-4" />, description: 'Parts of whole' },
        ],
    },
    {
        title: 'Hierarchical',
        charts: [
            { value: 'treemap', label: 'Treemap', icon: <Grid3X3 className="w-4 h-4" />, description: 'Nested proportions' },
            { value: 'sunburst', label: 'Sunburst', icon: <Sun className="w-4 h-4" />, description: 'Ring hierarchy' },
            { value: 'tree', label: 'Tree', icon: <GitGraph className="w-4 h-4" />, description: 'Org charts' },
        ],
    },
    {
        title: 'Statistical',
        charts: [
            { value: 'boxplot', label: 'Boxplot', icon: <BoxSelect className="w-4 h-4" />, description: 'Distributions' },
            { value: 'candlestick', label: 'Candlestick', icon: <CandlestickChart className="w-4 h-4" />, description: 'OHLC data' },
            { value: 'histogram', label: 'Histogram', icon: <BarChart className="w-4 h-4" />, description: 'Frequency bins' },
        ],
    },
    {
        title: 'Specialty',
        charts: [
            { value: 'radar', label: 'Radar', icon: <Target className="w-4 h-4" />, description: 'Multi-axis comparison' },
            { value: 'heatmap', label: 'Heatmap', icon: <Grid3X3 className="w-4 h-4" />, description: 'Intensity grid' },
            { value: 'funnel', label: 'Funnel', icon: <TrendingDown className="w-4 h-4" />, description: 'Conversion flow' },
            { value: 'gauge', label: 'Gauge', icon: <Gauge className="w-4 h-4" />, description: 'KPI display' },
        ],
    },
    {
        title: 'Financial',
        charts: [
            { value: 'waterfall', label: 'Waterfall', icon: <Layers className="w-4 h-4" />, description: 'Changes breakdown' },
            { value: 'parallel', label: 'Parallel', icon: <Workflow className="w-4 h-4" />, description: 'Multi-dimensional' },
            { value: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" />, description: 'Date heatmap' },
        ],
    },
    {
        title: 'Flow & Network',
        charts: [
            { value: 'sankey', label: 'Sankey', icon: <GitBranch className="w-4 h-4" />, description: 'Flow diagram' },
            { value: 'graph', label: 'Network', icon: <Network className="w-4 h-4" />, description: 'Relationships' },
        ],
    },
];

export function ChartTypeSelector() {
    const chartConfig = useVizStore((state) => state.chartConfig);
    const { setMark } = useVizStore();

    return (
        <div className="space-y-3">
            {CHART_GROUPS.map((group) => (
                <div key={group.title}>
                    <div className="px-1 mb-1.5">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.title}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {group.charts.map((chart) => {
                            const isActive = chartConfig.mark === chart.value;
                            return (
                                <Tooltip key={chart.value}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setMark(chart.value)}
                                            className={cn(
                                                "flex flex-col items-center gap-1 p-2 rounded-lg border",
                                                "transition-all duration-200 ease-out",
                                                // Hover: lift up and brighten
                                                "hover:-translate-y-0.5 hover:bg-primary/15 hover:border-primary/40 hover:text-primary hover:shadow-md",
                                                isActive
                                                    ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_12px_rgba(59,130,246,0.4)] -translate-y-0.5"
                                                    : "bg-card/30 border-border/50 text-muted-foreground"
                                            )}
                                        >
                                            {chart.icon}
                                            <span className="text-[10px] font-medium">{chart.label}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs font-medium">{chart.label}</p>
                                        <p className="text-xs text-muted-foreground">{chart.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
