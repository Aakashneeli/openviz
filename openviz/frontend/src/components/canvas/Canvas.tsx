// ============================================
// Canvas - Chart Visualization Panel
// ============================================

import { useState } from 'react';
import { BarChart3, Code, Download, Activity, LayoutGrid, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VizPreview } from './VizPreview';
import { CodeEditor } from './CodeEditor';
import { DashboardGrid } from './DashboardGrid';
import { useVizStore, selectEChartsOption, selectViewMode, selectDashboardConfig } from '@/store/useVizStore';
import { Input } from '@/components/ui/input';

export function Canvas() {
    const echartsOption = useVizStore(selectEChartsOption);
    const viewMode = useVizStore(selectViewMode);
    const dashboardConfig = useVizStore(selectDashboardConfig);
    const { setViewMode, createDashboard, addChartToDashboard, resetChart, setTitle, syncAndReturnToDashboard } = useVizStore();

    const chartConfig = useVizStore((state) => state.chartConfig);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(chartConfig.title || 'Untitled Chart');

    const handleTitleSave = () => {
        setTitle(editTitle.trim() || 'Untitled Chart');
        setIsEditingTitle(false);
    };

    // Show dashboard view if in dashboard mode
    if (viewMode === 'dashboard' && dashboardConfig) {
        return <DashboardGrid />;
    }

    return (
        <div className="flex flex-col h-full bg-background/50">
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Download Chart"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                onClick={resetChart}
                                title="Clear Chart"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
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
                    <div className="h-full min-h-[500px] bg-card/20 m-4 mt-2 rounded-xl border border-white/5 overflow-auto relative shadow-inner">
                        <VizPreview minHeight={460} />
                    </div>
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
