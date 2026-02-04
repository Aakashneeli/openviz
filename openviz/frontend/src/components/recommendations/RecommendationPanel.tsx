import { BarChart3, TrendingUp, Sparkles, X, PieChart, Triangle, Grid3X3, Target, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectChartRecommendations, selectEncodings } from '@/store/useVizStore';
import type { ChartRecommendation } from '@backend/types';

const MARK_ICONS: Record<string, typeof BarChart3> = {
    bar: BarChart3,
    line: TrendingUp,
    point: CircleDot,
    area: TrendingUp,
    arc: PieChart,
    funnel: Triangle,
    treemap: Grid3X3,
    radar: Target,
};

function RecommendationCard({ rec }: { rec: ChartRecommendation }) {
    const { applyRecommendation, dismissRecommendation } = useVizStore();
    const Icon = MARK_ICONS[rec.mark] || BarChart3;

    return (
        <div className="relative flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-500/40 hover:bg-white/10 transition-all group">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">
                    {rec.mark.charAt(0).toUpperCase() + rec.mark.slice(1)} Chart
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                    {rec.reason}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                    {rec.xField} × {rec.yField}
                </div>
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-white"
                    onClick={() => applyRecommendation(rec)}
                >
                    Apply
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => dismissRecommendation(rec.id)}
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

export function RecommendationPanel() {
    const recommendations = useVizStore(selectChartRecommendations);
    const encodings = useVizStore(selectEncodings);
    const dataset = useVizStore((s) => s.dataset);

    // Only show when: dataset loaded, no encodings yet, recommendations exist
    if (!dataset || encodings.length > 0 || recommendations.length === 0) return null;

    return (
        <div className="m-4 mb-0 p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-slate-200">Recommended Charts</span>
                <span className="text-[10px] text-slate-500 ml-auto">Based on your data</span>
            </div>
            <div className="space-y-2">
                {recommendations.slice(0, 5).map(rec => (
                    <RecommendationCard key={rec.id} rec={rec} />
                ))}
            </div>
        </div>
    );
}
