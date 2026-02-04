// ============================================
// DashboardGrid - Multi-Chart Display with Controls
// ============================================

import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { X, Maximize2, Activity, Trash2, Copy, Edit3, Plus, LayoutGrid, Pencil, Check, Sparkles, MessageSquare, ChevronDown, FileDown, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardSummaryPanel } from '@/components/canvas/DashboardSummaryPanel';
import { ReportGenerator } from '@/components/report/ReportGenerator';
import { useVizStore, selectDashboardConfig, selectDataset, selectDashboardSummary, selectSummaryLoading } from '@/store/useVizStore';
import { buildEChartsOption } from '@backend/utils/echartsOptionBuilder';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ChartConfig } from '@backend/types';
import { exportDashboardToPDF } from '@/services/exportService';
import { toast } from '@/lib/toast';

interface DashboardChartProps {
    config: ChartConfig;
    data: Record<string, unknown>[];
    isFocused: boolean;
    isBlur: boolean;
    onHover: (id: string | null) => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onAskAI: () => void;
}

function DashboardChart({ config, data, isFocused, isBlur, onHover, onEdit, onDelete, onDuplicate, onAskAI }: DashboardChartProps) {
    const echartsOption = config.encodings.length > 0
        ? buildEChartsOption(config, data)
        : null;

    const dashboardOption = echartsOption ? {
        ...echartsOption,
        grid: {
            ...(typeof echartsOption.grid === 'object' ? echartsOption.grid : {}),
            left: '10%',
            right: '10%',
            bottom: '15%',
            top: 40,
        },
    } : null;

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

                {/* Chart Controls - Always visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        onClick={onAskAI}
                        title="Ask AI about this chart"
                    >
                        <Sparkles className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={onEdit}
                        title="Edit Chart"
                    >
                        <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={onDuplicate}
                        title="Duplicate Chart"
                    >
                        <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={onDelete}
                        title="Delete Chart"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={onEdit}
                        title="Expand Chart"
                    >
                        <Maximize2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Chart */}
            <div className="p-2">
                {dashboardOption ? (
                    <ReactECharts
                        key={config.encodings.map(e => `${e.channel}:${e.field.name}`).join('|')}
                        option={dashboardOption}
                        style={{ width: '100%', height: 200 }}
                        notMerge={true}
                        lazyUpdate={false}
                        opts={{ renderer: 'canvas' }}
                    />
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

function EmptyDashboardState({
    onAIAutoSuggest,
    onBuildWithAI,
    isLoading
}: {
    onAIAutoSuggest: () => void;
    onBuildWithAI: () => void;
    isLoading?: boolean;
}) {
    return (
        <div className="flex flex-col items-center justify-center h-[450px] text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
                <LayoutGrid className="w-10 h-10 text-indigo-400" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Your Dashboard is Ready</h3>
            <p className="text-sm text-slate-400 mb-8 max-w-[350px]">
                Let's add your first chart. Choose how you'd like to create it:
            </p>

            {/* AI Options */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button
                    onClick={onAIAutoSuggest}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-5 h-auto flex-col gap-1 shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-semibold">AI Auto-Suggest</span>
                    </div>
                    <span className="text-xs opacity-80 font-normal">
                        {isLoading ? 'Generating...' : 'Let AI recommend a chart'}
                    </span>
                </Button>

                <Button
                    onClick={onBuildWithAI}
                    variant="outline"
                    className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white px-6 py-5 h-auto flex-col gap-1 transition-all hover:-translate-y-0.5"
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-semibold">Build with AI</span>
                    </div>
                    <span className="text-xs opacity-70 font-normal">Describe what you want</span>
                </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 text-slate-500 text-xs mb-4">
                <div className="w-16 h-px bg-slate-700" />
                <span>or</span>
                <div className="w-16 h-px bg-slate-700" />
            </div>

            {/* Manual hint */}
            <p className="text-xs text-slate-500">
                Drag fields from the <span className="text-indigo-400">Data Explorer</span> to manually build your chart
            </p>
        </div>
    );
}

export function DashboardGrid() {
    const dashboard = useVizStore(selectDashboardConfig);
    const dataset = useVizStore(selectDataset);
    const dashboardSummary = useVizStore(selectDashboardSummary);
    const summaryLoading = useVizStore(selectSummaryLoading);
    const {
        deleteDashboard,
        closeDashboard,
        renameDashboard,
        removeChartFromDashboard,
        duplicateChartInDashboard,
        editChartFromDashboard,
        generateDashboardSummary,
        setAIChatOpen,
        processAIQuery,
        openChatForChart,
        resetChart,
        setShowReportModal,
    } = useVizStore();

    const [hoveredChart, setHoveredChart] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [showAddChartMenu, setShowAddChartMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const dashboardRef = useRef<HTMLDivElement>(null);

    const handleExportDashboardPDF = async () => {
        if (!dashboardRef.current || !dashboard) return;

        setIsExporting(true);
        try {
            await exportDashboardToPDF(dashboardRef.current, dashboard.title || 'dashboard');
            toast.success('Dashboard exported successfully', {
                description: `${dashboard.charts.length} charts exported to PDF`,
            });
        } catch (error) {
            console.error('Dashboard export failed:', error);
            toast.error('Failed to export dashboard', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (dashboard) {
            setEditTitle(dashboard.title || 'Untitled Dashboard');
        }
    }, [dashboard?.title]);

    if (!dashboard) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                    <Activity className="w-8 h-8 text-indigo-500/50" />
                </div>
                <p className="text-sm">No dashboard active</p>
            </div>
        );
    }

    // Show data loading message when dashboard exists but no data
    if (!dataset) {
        return (
            <div className="flex flex-col h-full bg-transparent">
                {/* Dashboard Toolbar - Minimal */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 backdrop-blur-md z-20">
                    <h2 className="text-lg font-semibold text-slate-200">
                        {dashboard.title || 'New Dashboard'}
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeDashboard}
                        className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
                        title="Close Dashboard"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Empty state prompting to load data */}
                <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center p-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                        <Activity className="w-10 h-10 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-2">Load Data First</h3>
                        <p className="text-sm text-slate-400 max-w-[350px]">
                            To add charts to your dashboard, first upload or load a dataset from the <span className="text-indigo-400">Data Explorer</span> panel.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleTitleSave = () => {
        if (editTitle.trim()) {
            renameDashboard(editTitle.trim());
        }
        setIsEditingTitle(false);
    };

    const handleAIAutoSuggest = async () => {
        setIsAIGenerating(true);
        try {
            // Use AI to add a chart to the dashboard - use explicit wording to trigger modify_dashboard intent
            await processAIQuery('Add a new interesting chart to the dashboard that shows a different aspect of the data');
        } catch (error) {
            console.error('AI Auto-Suggest Error:', error);
        } finally {
            setIsAIGenerating(false);
        }
    };

    const handleBuildWithAI = () => {
        // Open the AI chat panel so user can describe what they want
        setAIChatOpen(true);
    };

    const handleManualAdd = () => {
        // Reset chart and switch to single view for manual chart building
        // Dashboard stays in memory so user can add chart back to it
        resetChart();
        useVizStore.setState({ viewMode: 'single', editingChartId: null });
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Dashboard Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 backdrop-blur-md z-20">
                {/* Left: Title */}
                <div className="flex items-center gap-3">
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-7 w-48 text-sm bg-white/10 border-white/20"
                                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                                autoFocus
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleTitleSave}
                                className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                            >
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <h2 className="font-semibold text-slate-100 text-sm tracking-wide">
                                {dashboard.title || 'Untitled Dashboard'}
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsEditingTitle(true)}
                                className="h-5 w-5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded">
                        {dashboard.charts.length} CHARTS
                    </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Add Chart Dropdown */}
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddChartMenu(!showAddChartMenu)}
                            className="h-7 text-xs bg-white/5 border-white/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 text-slate-300"
                        >
                            <Plus className="h-3 w-3 mr-1.5" />
                            Add Chart
                            <ChevronDown className={cn("h-3 w-3 ml-1.5 transition-transform", showAddChartMenu && "rotate-180")} />
                        </Button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {showAddChartMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-1 w-56 bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                                >
                                    <div className="p-1.5 space-y-0.5">
                                        <button
                                            onClick={() => {
                                                handleAIAutoSuggest();
                                                setShowAddChartMenu(false);
                                            }}
                                            disabled={isAIGenerating}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-indigo-500/20 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                                                <Sparkles className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-100">
                                                    {isAIGenerating ? 'Generating...' : 'AI Auto-Suggest'}
                                                </div>
                                                <div className="text-xs text-slate-400">Let AI recommend a chart</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                handleBuildWithAI();
                                                setShowAddChartMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-indigo-500/20 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                                <MessageSquare className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-100">Build with AI</div>
                                                <div className="text-xs text-slate-400">Describe what you want</div>
                                            </div>
                                        </button>

                                        <div className="border-t border-white/5 my-1" />

                                        <button
                                            onClick={() => {
                                                handleManualAdd();
                                                setShowAddChartMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-slate-700/50 border border-white/10 flex items-center justify-center">
                                                <Plus className="w-4 h-4 text-slate-300" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-100">Manual</div>
                                                <div className="text-xs text-slate-400">Drag fields to build</div>
                                            </div>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReportModal(true)}
                        className="h-7 text-xs bg-white/5 border-white/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 text-slate-300"
                        title="Generate Report"
                    >
                        <FileText className="h-3 w-3 mr-1.5" />
                        Report
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportDashboardPDF}
                        disabled={isExporting || dashboard.charts.length === 0}
                        className="h-7 text-xs bg-white/5 border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500/30 text-slate-300"
                        title="Export Dashboard as PDF"
                    >
                        {isExporting ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                            <FileDown className="h-3 w-3 mr-1.5" />
                        )}
                        Export PDF
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={deleteDashboard}
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Delete Dashboard"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeDashboard}
                        className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
                        title="Close Dashboard"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div ref={dashboardRef} className="flex-1 p-4 overflow-auto custom-scrollbar">
                {/* Dashboard Summary Panel */}
                <DashboardSummaryPanel
                    summary={dashboardSummary}
                    isLoading={summaryLoading}
                    onGenerate={generateDashboardSummary}
                />

                {dashboard.charts.length === 0 ? (
                    <EmptyDashboardState
                        onAIAutoSuggest={handleAIAutoSuggest}
                        onBuildWithAI={handleBuildWithAI}
                        isLoading={isAIGenerating}
                    />
                ) : (
                    <LayoutGroup>
                        <div
                            className="grid gap-4 mt-4"
                            style={{
                                gridTemplateColumns: `repeat(${dashboard.layout.cols}, 1fr)`,
                            }}
                        >
                            <AnimatePresence mode='popLayout'>
                                {isLoading ? (
                                    Array.from({ length: Math.min(4, dashboard.charts.length || 4) }).map((_, i) => (
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
                                            onHover={setHoveredChart}
                                            isFocused={!hoveredChart || hoveredChart === chart.id}
                                            isBlur={!!hoveredChart && hoveredChart !== chart.id}
                                            onEdit={() => editChartFromDashboard(chart.id)}
                                            onDelete={() => removeChartFromDashboard(chart.id)}
                                            onDuplicate={() => duplicateChartInDashboard(chart.id)}
                                            onAskAI={() => openChatForChart(chart.id)}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </LayoutGroup>
                )}
            </div>

            {/* Report modal */}
            <ReportGenerator />
        </div>
    );
}
