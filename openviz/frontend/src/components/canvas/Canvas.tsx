// ============================================
// Canvas - Chart Visualization Panel
// ============================================

import { BarChart3, Code, Download, Maximize2, Activity, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VizPreview } from './VizPreview';
import { CodeEditor } from './CodeEditor';
import { DashboardGrid } from './DashboardGrid';
import { useVizStore, selectVegaSpec, selectViewMode, selectDashboardConfig } from '@/store/useVizStore';

export function Canvas() {
    const vegaSpec = useVizStore(selectVegaSpec);
    const viewMode = useVizStore(selectViewMode);
    const dashboardConfig = useVizStore(selectDashboardConfig);
    const { setViewMode } = useVizStore();

    const chartConfig = useVizStore((state) => state.chartConfig);

    // Show dashboard view if in dashboard mode
    if (viewMode === 'dashboard' && dashboardConfig) {
        return <DashboardGrid />;
    }

    return (
        <div className="flex flex-col h-full bg-background/50">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-foreground text-sm">
                        {chartConfig.title || 'Untitled Chart'}
                    </h2>
                    {vegaSpec && (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            <Activity className="w-3 h-3" />
                            Live
                        </span>
                    )}
                </div>

                {vegaSpec && (
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => dashboardConfig ? setViewMode('dashboard') : null}
                            title={dashboardConfig ? "Back to Dashboard" : "Maximize"}
                        >
                            {dashboardConfig ? <LayoutGrid className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
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
