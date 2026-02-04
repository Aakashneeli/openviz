// ============================================
// Canvas - Chart Visualization Panel
// ============================================

import { useState, useRef } from 'react';
import { BarChart3, Code, Download, Activity, LayoutGrid, Plus, Trash2, Pencil, Check, Sparkles, Loader2, FileText, Filter, GitCompare, TrendingUp, X, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VizPreview } from './VizPreview';
import { CodeEditor } from './CodeEditor';
import { DashboardGrid } from './DashboardGrid';
import { RecommendationPanel } from '@/components/recommendations/RecommendationPanel';
import { ReportGenerator } from '@/components/report/ReportGenerator';
import { useVizStore, selectEChartsOption, selectViewMode, selectDashboardConfig, selectActiveFilters, selectComparisonResult, selectForecastData } from '@/store/useVizStore';
import { Input } from '@/components/ui/input';
import { exportChartToPDF, exportToPNG, exportToSVG } from '@/services/exportService';
import { toast } from '@/lib/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Canvas() {
    const echartsOption = useVizStore(selectEChartsOption);
    const viewMode = useVizStore(selectViewMode);
    const dashboardConfig = useVizStore(selectDashboardConfig);
    const showAnnotations = useVizStore((state) => state.showAnnotations);
    const activeFilters = useVizStore(selectActiveFilters);
    const comparisonResult = useVizStore(selectComparisonResult);
    const forecastData = useVizStore(selectForecastData);
    const filteredData = useVizStore((state) => state.filteredData);
    const dataset = useVizStore((state) => state.dataset);
    const { setViewMode, createDashboard, addChartToDashboard, resetChart, setTitle, syncAndReturnToDashboard, toggleAnnotations, clearFilters, clearComparison, clearForecast, setShowReportModal } = useVizStore();

    const chartConfig = useVizStore((state) => state.chartConfig);
    const editingChartId = useVizStore((state) => state.editingChartId);
    const isEditingFromDashboard = !!dashboardConfig && !!editingChartId;

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(chartConfig.title || 'Untitled Chart');
    const [isExporting, setIsExporting] = useState(false);

    const chartRef = useRef<HTMLDivElement>(null);

    const handleTitleSave = () => {
        setTitle(editTitle.trim() || 'Untitled Chart');
        setIsEditingTitle(false);
    };

    const handleExportPDF = async () => {
        if (!chartRef.current || !echartsOption) return;

        setIsExporting(true);
        try {
            await exportChartToPDF(chartRef.current, {
                filename: `${chartConfig.title || 'chart'}.pdf`,
            });
            toast.success('PDF exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export PDF', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPNG = (pixelRatio: 1 | 2 | 3) => {
        if (!chartRef.current || !echartsOption) return;

        setIsExporting(true);
        try {
            exportToPNG(chartRef.current, {
                filename: `${chartConfig.title || 'chart'}.png`,
                pixelRatio,
                backgroundColor: '#1a1a1a',
            });
            toast.success('PNG exported successfully', {
                description: `${pixelRatio}x resolution`,
            });
        } catch (error) {
            console.error('PNG export failed:', error);
            toast.error('Failed to export PNG', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportSVG = () => {
        if (!chartRef.current || !echartsOption) return;

        setIsExporting(true);
        try {
            exportToSVG(chartRef.current, {
                filename: `${chartConfig.title || 'chart'}.svg`,
                backgroundColor: '#1a1a1a',
            });
            toast.success('SVG exported successfully');
        } catch (error) {
            console.error('SVG export failed:', error);
            toast.error('Failed to export SVG', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setIsExporting(false);
        }
    };

    // Show dashboard view if in dashboard mode
    if (viewMode === 'dashboard' && dashboardConfig) {
        return <DashboardGrid />;
    }

    return (
        <div className="flex flex-col h-full bg-background/50">
            {/* Breadcrumb bar — shown when editing a chart from a dashboard */}
            {isEditingFromDashboard && (
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-indigo-500/20 bg-indigo-500/5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1.5 px-2"
                        onClick={syncAndReturnToDashboard}
                    >
                        <ArrowLeft className="h-3 w-3" />
                        {dashboardConfig?.title || 'Dashboard'}
                    </Button>
                    <ChevronRight className="h-3 w-3 text-slate-600" />
                    <span className="text-[11px] text-slate-400">
                        Editing chart
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
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
                            <h2 className="font-semibold text-foreground text-sm">
                                {chartConfig.title || 'Untitled Chart'}
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setEditTitle(chartConfig.title || 'Untitled Chart');
                                    setIsEditingTitle(true);
                                }}
                                className="h-5 w-5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    {echartsOption && (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            <Activity className="w-3 h-3" />
                            Live
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Dashboard actions - always available */}
                    {dashboardConfig ? (
                        <>
                            {echartsOption ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                                    onClick={() => {
                                        addChartToDashboard();
                                        setViewMode('dashboard');
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1.5" />
                                    Add to Dashboard
                                </Button>
                            ) : (
                                <span className="text-xs text-slate-400 px-2">
                                    Drag fields to create chart
                                </span>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10 text-slate-300"
                                onClick={syncAndReturnToDashboard}
                                title="Back to Dashboard (saves changes)"
                            >
                                <LayoutGrid className="h-3 w-3 mr-1.5" />
                                Dashboard
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-white/5 border-white/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 text-slate-300"
                            onClick={() => createDashboard()}
                            title={echartsOption ? "Create dashboard with this chart" : "Create an empty dashboard"}
                        >
                            <LayoutGrid className="h-3 w-3 mr-1.5" />
                            {echartsOption ? 'Create Dashboard' : 'New Dashboard'}
                        </Button>
                    )}
                    {echartsOption && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-7 text-xs transition-all ${showAnnotations
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={toggleAnnotations}
                                    >
                                        <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${showAnnotations ? 'animate-pulse' : ''}`} />
                                        Insights
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">Toggle smart annotations</p>
                                    <p className="text-xs text-muted-foreground">Shows outliers, max/min values</p>
                                </TooltipContent>
                            </Tooltip>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setShowReportModal(true)}
                                title="Generate Report"
                            >
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Report
                            </Button>
                            <DropdownMenu>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                disabled={isExporting}
                                            >
                                                {isExporting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Export chart (PNG, SVG, PDF)</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="text-xs">
                                            PNG Image
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={() => handleExportPNG(1)} className="text-xs">
                                                1x (Standard)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExportPNG(2)} className="text-xs">
                                                2x (High DPI)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExportPNG(3)} className="text-xs">
                                                3x (Retina)
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem onClick={handleExportSVG} className="text-xs">
                                        SVG Vector
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleExportPDF} className="text-xs">
                                        PDF Document
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                        onClick={resetChart}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">Clear chart and all encodings</p>
                                </TooltipContent>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>

            {/* Main content with tabs */}
            <Tabs defaultValue="chart" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 pt-2">
                    <TabsList className="h-8 p-0.5 bg-card/50 border border-border/50">
                        <TabsTrigger
                            value="chart"
                            className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                            <BarChart3 className="h-3 w-3 mr-1.5" />
                            Chart
                        </TabsTrigger>
                        <TabsTrigger
                            value="code"
                            className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                            <Code className="h-3 w-3 mr-1.5" />
                            Spec
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="chart" className="flex-1 m-0 overflow-auto">
                    {/* Feature badges */}
                    <div className="flex items-center gap-2 px-4 pt-2 flex-wrap">
                        {activeFilters && (
                            <span className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <Filter className="w-3 h-3" />
                                Filtered: {filteredData?.length ?? '?'} of {dataset?.data.length ?? '?'} rows
                                <button onClick={clearFilters} className="ml-1 hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                        {comparisonResult && (
                            <span className="flex items-center gap-1.5 text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                <GitCompare className="w-3 h-3" />
                                {comparisonResult.percentChange > 0 ? '+' : ''}{comparisonResult.percentChange.toFixed(1)}% change
                                <button onClick={clearComparison} className="ml-1 hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                        {forecastData && (
                            <span className="flex items-center gap-1.5 text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                                <TrendingUp className="w-3 h-3" />
                                Forecast: {forecastData.periods} periods
                                <button onClick={clearForecast} className="ml-1 hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        )}
                    </div>

                    {/* Chart recommendations */}
                    <RecommendationPanel />

                    <div
                        ref={chartRef}
                        className="h-full min-h-[500px] bg-card/20 m-4 mt-2 rounded-xl border border-white/5 overflow-auto relative shadow-inner"
                    >
                        <VizPreview minHeight={460} />
                    </div>

                    {/* Report modal */}
                    <ReportGenerator />
                </TabsContent>

                <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
                    <div className="h-full m-4 mt-2">
                        <CodeEditor />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
