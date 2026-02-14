// ============================================
// DrillBreadcrumb - Drill-Down Navigation Trail
// Shows current drill path with clickable levels
// ============================================

import { ChevronRight, ArrowUp, RotateCcw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectDrillPath, selectDrillHierarchies, selectDrillActiveField } from '@/store/useVizStore';
import { getCurrentDrillLevel, canDrillDeeper } from '@backend/services/drillService';
import { cn } from '@/lib/utils';

export function DrillBreadcrumb() {
    const drillPath = useVizStore(selectDrillPath);
    const drillHierarchies = useVizStore(selectDrillHierarchies);
    const drillActiveField = useVizStore(selectDrillActiveField);
    const { drillUp, drillReset } = useVizStore();

    if (drillPath.length === 0) return null;

    const hierarchy = drillHierarchies.find(h => h.sourceField === drillActiveField);
    if (!hierarchy) return null;

    const currentLevel = getCurrentDrillLevel(drillPath, hierarchy.availableLevels);
    const canGoDeeper = canDrillDeeper(drillPath, hierarchy.availableLevels);

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs">
            <Layers className="h-3 w-3 text-cyan-400 shrink-0" />

            {/* All (root) button */}
            <button
                onClick={drillReset}
                className="text-cyan-300 hover:text-cyan-100 font-medium transition-colors cursor-pointer"
            >
                All
            </button>

            {/* Path steps */}
            {drillPath.map((step, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3 text-cyan-500/50" />
                    <span className={cn(
                        "font-medium transition-colors",
                        idx === drillPath.length - 1
                            ? "text-cyan-200"
                            : "text-cyan-400"
                    )}>
                        {step.label}
                    </span>
                </span>
            ))}

            {/* Current display level indicator */}
            <span className="text-cyan-500/60 ml-1">
                (showing {currentLevel}s)
            </span>

            {/* Drill up button */}
            <div className="flex items-center gap-1 ml-auto">
                {canGoDeeper && (
                    <span className="text-cyan-500/40 text-[10px] mr-1">
                        Click chart to drill deeper
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={drillUp}
                    className="h-5 w-5 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20"
                    title="Drill up one level"
                >
                    <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={drillReset}
                    className="h-5 w-5 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20"
                    title="Reset to top level"
                >
                    <RotateCcw className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}
