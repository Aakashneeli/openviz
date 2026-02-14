// ============================================
// TemplateGallery - Browse and apply chart templates
// ============================================

import { useState, useMemo } from 'react';
import {
    BarChart3,
    LineChart,
    ScatterChart,
    PieChart,
    Target,
    Grid3X3,
    TrendingDown,
    TrendingUp,
    Layers,
    BoxSelect,
    Check,
    X,
    Search,
    LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useVizStore, selectDataset } from '@/store/useVizStore';
import {
    chartTemplates,
    TEMPLATE_CATEGORIES,
    autoMapFields,
    canApplyTemplate,
    type ChartTemplate,
    type TemplateCategory,
} from '@/data/chartTemplates';
import { toast } from '@/lib/toast';

// ============================================
// Icon mapping
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
    BarChart3: <BarChart3 className="w-5 h-5" />,
    LineChart: <LineChart className="w-5 h-5" />,
    ScatterChart: <ScatterChart className="w-5 h-5" />,
    PieChart: <PieChart className="w-5 h-5" />,
    Target: <Target className="w-5 h-5" />,
    Grid3X3: <Grid3X3 className="w-5 h-5" />,
    TrendingDown: <TrendingDown className="w-5 h-5" />,
    TrendingUp: <TrendingUp className="w-5 h-5" />,
    Layers: <Layers className="w-5 h-5" />,
    BoxSelect: <BoxSelect className="w-5 h-5" />,
};

// ============================================
// Component
// ============================================

interface TemplateGalleryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TemplateGallery({ open, onOpenChange }: TemplateGalleryProps) {
    const dataset = useVizStore(selectDataset);
    const { applyTemplate } = useVizStore();

    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<ChartTemplate | null>(null);

    // Filter templates by category and search
    const filteredTemplates = useMemo(() => {
        return chartTemplates.filter(t => {
            if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    t.name.toLowerCase().includes(q) ||
                    t.description.toLowerCase().includes(q) ||
                    t.category.includes(q)
                );
            }
            return true;
        });
    }, [selectedCategory, searchQuery]);

    // Check which templates can be applied to current data
    const applicabilityMap = useMemo(() => {
        if (!dataset) return new Map<string, boolean>();
        const fields = dataset.fields.map(f => ({ name: f.name, type: f.type }));
        return new Map(chartTemplates.map(t => [t.id, canApplyTemplate(t, fields)]));
    }, [dataset]);

    // Auto-mapping preview for selected template
    const fieldMapping = useMemo(() => {
        if (!selectedTemplate || !dataset) return null;
        const fields = dataset.fields.map(f => ({ name: f.name, type: f.type }));
        return autoMapFields(selectedTemplate, fields);
    }, [selectedTemplate, dataset]);

    const handleApply = () => {
        if (!selectedTemplate || !dataset) return;

        applyTemplate(selectedTemplate);
        toast.success(`Applied "${selectedTemplate.name}" template`);
        onOpenChange(false);
        setSelectedTemplate(null);
        setSearchQuery('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <LayoutTemplate className="w-4 h-4 text-indigo-400" />
                        Chart Templates
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Choose a template and auto-map your data fields
                    </DialogDescription>
                </DialogHeader>

                {/* Search + Category filter */}
                <div className="px-5 py-3 space-y-2 border-b border-border/30">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
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
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
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
                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
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
                                <p className="text-sm">No templates match your search</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {filteredTemplates.map(template => {
                                    const canApply = applicabilityMap.get(template.id) ?? false;
                                    const isSelected = selectedTemplate?.id === template.id;

                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplate(template)}
                                            className={cn(
                                                "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                                                isSelected
                                                    ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                                                    : "bg-card/30 border-border/50 hover:bg-card/60 hover:border-border",
                                                !dataset && "opacity-60"
                                            )}
                                        >
                                            <div className={cn(
                                                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                                                isSelected
                                                    ? "bg-indigo-500/20 text-indigo-300"
                                                    : "bg-muted/30 text-muted-foreground"
                                            )}>
                                                {ICON_MAP[template.icon] || <BarChart3 className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-foreground truncate">
                                                        {template.name}
                                                    </span>
                                                    {dataset && canApply && (
                                                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                                    )}
                                                    {dataset && !canApply && (
                                                        <X className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                                    {template.description}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Detail panel */}
                    {selectedTemplate && (
                        <div className="w-56 border-l border-border/50 p-4 overflow-y-auto bg-card/20">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{selectedTemplate.name}</h3>
                                    <p className="text-[10px] text-muted-foreground mt-1">{selectedTemplate.description}</p>
                                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[9px] font-medium bg-card border border-border/50 rounded-full text-muted-foreground capitalize">
                                        {selectedTemplate.mark} chart
                                    </span>
                                </div>

                                {/* Field mapping preview */}
                                <div>
                                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Field Mapping
                                    </h4>
                                    <div className="space-y-1.5">
                                        {selectedTemplate.slots.map(slot => {
                                            const mapped = fieldMapping?.get(slot.channel);
                                            return (
                                                <div key={slot.channel} className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted-foreground w-14 truncate" title={slot.label}>
                                                        {slot.label}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground/60">→</span>
                                                    {mapped ? (
                                                        <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded truncate" title={mapped.name}>
                                                            {mapped.name}
                                                        </span>
                                                    ) : (
                                                        <span className={cn(
                                                            "text-[10px] px-1.5 py-0.5 rounded",
                                                            slot.required
                                                                ? "text-red-400/80 bg-red-500/10"
                                                                : "text-muted-foreground/50 bg-muted/20"
                                                        )}>
                                                            {slot.required ? 'No match' : 'Skipped'}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Apply button */}
                                <Button
                                    size="sm"
                                    className="w-full h-8 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
                                    disabled={!dataset || !(applicabilityMap.get(selectedTemplate.id) ?? false)}
                                    onClick={handleApply}
                                >
                                    {!dataset
                                        ? 'Load data first'
                                        : !(applicabilityMap.get(selectedTemplate.id) ?? false)
                                            ? 'Incompatible data'
                                            : 'Apply Template'
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
