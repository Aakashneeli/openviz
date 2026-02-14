// ============================================
// DashboardTemplateGallery - Browse and apply dashboard templates
// ============================================

import { useState, useMemo } from 'react';
import {
    BarChart3,
    TrendingUp,
    Filter,
    Megaphone,
    Activity,
    DollarSign,
    GitBranch,
    Check,
    X,
    Search,
    LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useVizStore, selectDataset } from '@/store/useVizStore';
import { TEMPLATE_CATEGORIES } from '@/data/chartTemplates';
import {
    dashboardTemplates,
    getDashboardTemplateApplicability,
} from '@/data/dashboardTemplates';
import { getChartTemplateById, canApplyTemplate } from '@/data/chartTemplates';
import type { DashboardTemplate } from '@backend/types';

// ============================================
// Icon mapping
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
    TrendingUp: <TrendingUp className="w-5 h-5" />,
    Filter: <Filter className="w-5 h-5" />,
    Megaphone: <Megaphone className="w-5 h-5" />,
    BarChart3: <BarChart3 className="w-5 h-5" />,
    Activity: <Activity className="w-5 h-5" />,
    DollarSign: <DollarSign className="w-5 h-5" />,
    GitBranch: <GitBranch className="w-5 h-5" />,
};

// Mark type → display label
const MARK_LABELS: Record<string, string> = {
    bar: 'Bar',
    line: 'Line',
    area: 'Area',
    arc: 'Pie',
    point: 'Scatter',
    radar: 'Radar',
    funnel: 'Funnel',
    rect: 'Heatmap',
    boxplot: 'Boxplot',
    treemap: 'Treemap',
    waterfall: 'Waterfall',
};

// Colors for layout preview slots
const SLOT_COLORS = [
    'bg-blue-500/30 border-blue-500/40',
    'bg-emerald-500/30 border-emerald-500/40',
    'bg-amber-500/30 border-amber-500/40',
    'bg-purple-500/30 border-purple-500/40',
];

// ============================================
// Component
// ============================================

interface DashboardTemplateGalleryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DashboardTemplateGallery({ open, onOpenChange }: DashboardTemplateGalleryProps) {
    const dataset = useVizStore(selectDataset);
    const { applyDashboardTemplate } = useVizStore();

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate | null>(null);

    // Filter templates by category and search
    const filteredTemplates = useMemo(() => {
        return dashboardTemplates.filter(t => {
            if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    t.name.toLowerCase().includes(q) ||
                    t.description.toLowerCase().includes(q) ||
                    t.category.includes(q) ||
                    t.tags.some(tag => tag.includes(q))
                );
            }
            return true;
        });
    }, [selectedCategory, searchQuery]);

    // Applicability for all templates
    const applicabilityMap = useMemo(() => {
        if (!dataset) return new Map<string, { total: number; applicable: number; canApply: boolean }>();
        const fields = dataset.fields.map(f => ({ name: f.name, type: f.type }));
        return new Map(dashboardTemplates.map(t => [t.id, getDashboardTemplateApplicability(t, fields)]));
    }, [dataset]);

    const handleApply = () => {
        if (!selectedTemplate || !dataset) return;

        applyDashboardTemplate(selectedTemplate);
        onOpenChange(false);
        setSelectedTemplate(null);
        setSearchQuery('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <LayoutGrid className="w-4 h-4 text-cyan-400" />
                        Dashboard Templates
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Create a multi-chart dashboard from a pre-built template
                    </DialogDescription>
                </DialogHeader>

                {/* Search + Category filter */}
                <div className="px-5 py-3 space-y-2 border-b border-border/30">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search dashboard templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs bg-card/50 border-border/50"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                                selectedCategory === 'all'
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                    : "bg-card/50 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                            )}
                        >
                            All
                        </button>
                        {TEMPLATE_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                                    selectedCategory === cat.id
                                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                        : "bg-card/50 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template grid + detail panel */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Template list */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {filteredTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                <p className="text-sm">No dashboard templates match your search</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {filteredTemplates.map(template => {
                                    const applicability = applicabilityMap.get(template.id);
                                    const canApply = applicability?.canApply ?? false;
                                    const isSelected = selectedTemplate?.id === template.id;

                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplate(template)}
                                            className={cn(
                                                "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                                                isSelected
                                                    ? "bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                                                    : "bg-card/30 border-border/50 hover:bg-card/60 hover:border-border",
                                                !dataset && "opacity-60"
                                            )}
                                        >
                                            <div className={cn(
                                                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                                                isSelected
                                                    ? "bg-cyan-500/20 text-cyan-300"
                                                    : "bg-muted/30 text-muted-foreground"
                                            )}>
                                                {ICON_MAP[template.icon] || <BarChart3 className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-foreground truncate">
                                                        {template.name}
                                                    </span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground flex-shrink-0">
                                                        {template.chartSlots.length} charts
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                                    {template.description}
                                                </p>
                                                {dataset && applicability && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {canApply ? (
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                        ) : (
                                                            <X className="w-3 h-3 text-red-400/60" />
                                                        )}
                                                        <span className={cn(
                                                            "text-[9px]",
                                                            canApply ? "text-emerald-400/80" : "text-red-400/60"
                                                        )}>
                                                            {applicability.applicable}/{applicability.total} charts compatible
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Detail panel */}
                    {selectedTemplate && (
                        <div className="w-64 border-l border-border/50 p-4 overflow-y-auto bg-card/20">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{selectedTemplate.name}</h3>
                                    <p className="text-[10px] text-muted-foreground mt-1">{selectedTemplate.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className="px-2 py-0.5 text-[9px] font-medium bg-card border border-border/50 rounded-full text-muted-foreground capitalize">
                                            {selectedTemplate.category}
                                        </span>
                                        <span className="px-2 py-0.5 text-[9px] font-medium bg-card border border-border/50 rounded-full text-muted-foreground">
                                            {selectedTemplate.chartSlots.length} charts
                                        </span>
                                    </div>
                                </div>

                                {/* Layout preview */}
                                <div>
                                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Layout Preview
                                    </h4>
                                    <div
                                        className="grid gap-1.5 p-2 rounded-lg bg-card/40 border border-border/30"
                                        style={{ gridTemplateColumns: `repeat(${selectedTemplate.cols}, 1fr)` }}
                                    >
                                        {selectedTemplate.chartSlots.map((slot, i) => {
                                            const chartTemplate = getChartTemplateById(slot.chartTemplateId);
                                            const isApplicable = dataset && chartTemplate
                                                ? canApplyTemplate(chartTemplate, dataset.fields.map(f => ({ name: f.name, type: f.type })))
                                                : false;

                                            return (
                                                <div
                                                    key={slot.chartTemplateId + '-' + i}
                                                    className={cn(
                                                        "rounded-md border p-2 flex flex-col items-center justify-center min-h-[48px]",
                                                        SLOT_COLORS[i % SLOT_COLORS.length],
                                                        !isApplicable && dataset && "opacity-40"
                                                    )}
                                                    style={{
                                                        gridColumn: `span ${slot.layout.colSpan}`,
                                                    }}
                                                >
                                                    <span className="text-[8px] font-medium text-foreground/80 text-center leading-tight">
                                                        {slot.suggestedTitle}
                                                    </span>
                                                    {chartTemplate && (
                                                        <span className="text-[7px] text-muted-foreground mt-0.5">
                                                            {MARK_LABELS[chartTemplate.mark] || chartTemplate.mark}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Chart details */}
                                <div>
                                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Charts
                                    </h4>
                                    <div className="space-y-1.5">
                                        {selectedTemplate.chartSlots.map((slot, i) => {
                                            const chartTemplate = getChartTemplateById(slot.chartTemplateId);
                                            const isApplicable = dataset && chartTemplate
                                                ? canApplyTemplate(chartTemplate, dataset.fields.map(f => ({ name: f.name, type: f.type })))
                                                : false;

                                            return (
                                                <div key={slot.chartTemplateId + '-detail-' + i} className="flex items-center gap-2">
                                                    {dataset && (
                                                        isApplicable
                                                            ? <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                                            : <X className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] text-foreground/80 truncate block">
                                                            {slot.suggestedTitle}
                                                        </span>
                                                        {chartTemplate && (
                                                            <span className="text-[9px] text-muted-foreground">
                                                                {MARK_LABELS[chartTemplate.mark] || chartTemplate.mark} chart
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Apply button */}
                                <Button
                                    size="sm"
                                    className="w-full h-8 text-xs bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0"
                                    disabled={!dataset || !(applicabilityMap.get(selectedTemplate.id)?.canApply ?? false)}
                                    onClick={handleApply}
                                >
                                    {!dataset
                                        ? 'Load data first'
                                        : !(applicabilityMap.get(selectedTemplate.id)?.canApply ?? false)
                                            ? 'Not enough compatible charts'
                                            : `Create Dashboard (${applicabilityMap.get(selectedTemplate.id)?.applicable ?? 0} charts)`
                                    }
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
