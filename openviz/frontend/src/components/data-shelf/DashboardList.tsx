// ============================================
// DashboardList - Saved Dashboards Browser Panel
// ============================================

import { useState } from 'react';
import { LayoutGrid, Trash2, Plus, ChevronDown, ChevronRight, Clock, BarChart3, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectSavedDashboards, selectDashboardConfig, selectViewMode, selectDataset } from '@/store/useVizStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function DashboardList() {
    const savedDashboards = useVizStore(selectSavedDashboards);
    const activeDashboard = useVizStore(selectDashboardConfig);
    const viewMode = useVizStore(selectViewMode);
    const dataset = useVizStore(selectDataset);
    const { loadDashboard, deleteSavedDashboard, createDashboard } = useVizStore();

    const [expanded, setExpanded] = useState(true);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Don't show dashboard panel until data is loaded
    if (!dataset) return null;

    const sorted = [...savedDashboards].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="border-t border-white/5 mt-1">
            {/* Section Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full h-10 px-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Dashboards
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {savedDashboards.length > 0 && (
                        <span className="text-[9px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {savedDashboards.length}
                        </span>
                    )}
                    {expanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                </div>
            </button>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 pb-3 space-y-1.5">
                            {/* New Dashboard button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => createDashboard()}
                                className="w-full h-8 text-[11px] bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/25 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 justify-center gap-2 transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New Dashboard
                            </Button>

                            {/* Dashboard list */}
                            {sorted.length === 0 ? (
                                <div className="flex flex-col items-center py-6 px-3 text-center">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                                        <LayoutGrid className="w-5 h-5 text-slate-600" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-1">No dashboards yet</p>
                                    <p className="text-[10px] text-slate-600">
                                        Create one to organize multiple charts together
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {sorted.map((saved) => {
                                        const isActive = activeDashboard?.id === saved.id;
                                        const isViewing = isActive && viewMode === 'dashboard';
                                        const isConfirming = confirmDeleteId === saved.id;
                                        const chartCount = saved.config.charts.length;

                                        return (
                                            <motion.div
                                                key={saved.id}
                                                layout
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className={cn(
                                                    "group relative flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150",
                                                    isViewing
                                                        ? "bg-indigo-500/20 border border-indigo-500/40 shadow-sm shadow-indigo-500/10"
                                                        : isActive
                                                            ? "bg-indigo-500/10 border border-indigo-500/20"
                                                            : "hover:bg-white/5 border border-transparent hover:border-white/10"
                                                )}
                                                onClick={() => loadDashboard(saved.id)}
                                            >
                                                {/* Dashboard icon */}
                                                <div className={cn(
                                                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                                                    isViewing
                                                        ? "bg-indigo-500/30"
                                                        : "bg-white/5"
                                                )}>
                                                    <LayoutGrid className={cn(
                                                        "h-3.5 w-3.5",
                                                        isViewing ? "text-indigo-300" : isActive ? "text-indigo-400" : "text-slate-500"
                                                    )} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-[11px] truncate leading-tight",
                                                        isViewing ? "text-indigo-100 font-semibold" : isActive ? "text-indigo-200 font-medium" : "text-slate-300"
                                                    )}>
                                                        {saved.config.title || 'Untitled Dashboard'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="flex items-center gap-1 text-[9px] text-slate-500">
                                                            <BarChart3 className="h-2.5 w-2.5" />
                                                            {chartCount} {chartCount === 1 ? 'chart' : 'charts'}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[9px] text-slate-600">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatDate(saved.updatedAt)}
                                                        </span>
                                                    </div>
                                                    {isViewing && (
                                                        <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-semibold text-indigo-400 uppercase tracking-wider">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                                            Active
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Delete control */}
                                                {isConfirming ? (
                                                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md"
                                                            onClick={() => {
                                                                deleteSavedDashboard(saved.id);
                                                                setConfirmDeleteId(null);
                                                            }}
                                                            title="Confirm delete"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10 rounded-md"
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            title="Cancel"
                                                        >
                                                            <span className="text-[10px] font-bold">✕</span>
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-md"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmDeleteId(saved.id);
                                                        }}
                                                        title="Delete dashboard"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
