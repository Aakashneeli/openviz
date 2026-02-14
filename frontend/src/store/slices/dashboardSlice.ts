import { v4 as uuidv4 } from 'uuid';
import type {
    Dataset,
    ChartConfig,
    DashboardConfig,
    SavedDashboard,
    CrossFilter,
} from '@backend/types';
import { generateDataProfile } from '@backend/services/dataContextService';
import type { StoreSet, StoreGet } from './types';
import { initialChartConfig } from './chartSlice';

// ============================================
// localStorage Persistence Helpers
// ============================================

const DASHBOARDS_STORAGE_KEY = 'openviz-dashboards';

function saveDashboardsToStorage(dashboards: SavedDashboard[]): void {
    try {
        localStorage.setItem(DASHBOARDS_STORAGE_KEY, JSON.stringify(dashboards));
    } catch (e) {
        console.error('Failed to save dashboards to localStorage:', e);
    }
}

function loadDashboardsFromStorage(): SavedDashboard[] {
    try {
        const raw = localStorage.getItem(DASHBOARDS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as SavedDashboard[];
        // Revive Date objects
        return parsed.map(d => ({
            ...d,
            updatedAt: new Date(d.updatedAt),
            config: { ...d.config, createdAt: new Date(d.config.createdAt) },
        }));
    } catch (e) {
        console.error('Failed to load dashboards from localStorage:', e);
        return [];
    }
}

// ============================================
// Dashboard Slice
// ============================================

export const createDashboardSlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    dashboardConfig: null as DashboardConfig | null,
    savedDashboards: loadDashboardsFromStorage() as SavedDashboard[],
    viewMode: 'single' as 'single' | 'dashboard',
    editingChartId: null as string | null,
    crossFilters: [] as CrossFilter[],
    crossFilterEnabled: true,

    // Actions

    setDashboardConfig: (config: DashboardConfig | null) => {
        set({ dashboardConfig: config });
    },

    setViewMode: (mode: 'single' | 'dashboard') => {
        set({ viewMode: mode });
    },

    closeDashboard: () => {
        const state = get() as any;
        const { dashboardConfig } = state;
        if (dashboardConfig) {
            (get() as any).saveDashboard();
        }
        set({
            viewMode: 'single',
            dashboardConfig: null,
            editingChartId: null,
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
            dashboardSummary: null,
            crossFilters: [],
        });
    },

    createDashboard: (title?: string) => {
        const state = get() as any;
        const { chartConfig, encodings, dashboardConfig: existingDashboard } = state;

        // Save existing dashboard before creating new one
        if (existingDashboard) {
            (get() as any).saveDashboard();
        }

        // If there's a chart with encodings in single view, include it
        const hasChart = encodings.length > 0;
        const currentChart = hasChart
            ? { ...chartConfig, id: uuidv4(), encodings: [...encodings] }
            : null;

        const newDashboard: DashboardConfig = {
            id: uuidv4(),
            title: title || 'New Dashboard',
            charts: currentChart ? [currentChart] : [],
            layout: {
                cols: 2,
                rows: 10,
                items: currentChart ? [{
                    chartId: currentChart.id,
                    col: 0,
                    row: 0,
                    colSpan: 1,
                    rowSpan: 1,
                }] : [],
            },
            createdAt: new Date(),
        };

        set({
            dashboardConfig: newDashboard,
            viewMode: 'dashboard',
            editingChartId: null,
            // Reset single chart state
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
        });
        (get() as any).saveDashboard();
    },

    deleteDashboard: () => {
        const state = get() as any;
        const { dashboardConfig, savedDashboards } = state;
        const dashId = dashboardConfig?.id;
        // Also remove from saved dashboards
        const updated = dashId ? savedDashboards.filter((d: SavedDashboard) => d.id !== dashId) : savedDashboards;
        saveDashboardsToStorage(updated);
        set({
            dashboardConfig: null,
            savedDashboards: updated,
            viewMode: 'single',
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
            dashboardSummary: null,
            crossFilters: [],
        });
    },

    saveDashboard: () => {
        const state = get() as any;
        const { dashboardConfig, savedDashboards } = state;
        if (!dashboardConfig) return;
        const entry: SavedDashboard = {
            id: dashboardConfig.id,
            config: dashboardConfig,
            updatedAt: new Date(),
        };
        const exists = savedDashboards.findIndex((d: SavedDashboard) => d.id === dashboardConfig.id);
        const updated = exists >= 0
            ? savedDashboards.map((d: SavedDashboard) => d.id === dashboardConfig.id ? entry : d)
            : [...savedDashboards, entry];
        saveDashboardsToStorage(updated);
        set({ savedDashboards: updated });
    },

    loadDashboard: (id: string) => {
        const state = get() as any;
        const { savedDashboards, dashboardConfig: currentDashboard } = state;
        const found = savedDashboards.find((d: SavedDashboard) => d.id === id);
        if (!found) return;

        // If already viewing this dashboard, just switch to dashboard view
        if (currentDashboard?.id === id) {
            set({ viewMode: 'dashboard', editingChartId: null });
            return;
        }

        // Save current dashboard before switching
        if (currentDashboard) {
            (get() as any).saveDashboard();
        }

        set({
            dashboardConfig: found.config,
            viewMode: 'dashboard',
            editingChartId: null,
            // Reset single chart state
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
        });
    },

    importDashboard: (dashboard: DashboardConfig, dataset: Dataset) => {
        // Save current dashboard if any
        const state = get() as any;
        const { dashboardConfig: currentDashboard } = state;
        if (currentDashboard) {
            (get() as any).saveDashboard();
        }

        // Set the imported dataset and dashboard
        set({
            dataset,
            dataProfile: null,
            dashboardConfig: dashboard,
            viewMode: 'dashboard',
            editingChartId: null,
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
        });

        // Save the imported dashboard
        (get() as any).saveDashboard();

        // Generate data profile in background
        try {
            const profile = generateDataProfile(dataset.data, dataset.fields);
            set({ dataProfile: profile });
        } catch (e) {
            console.warn('Failed to generate data profile for imported dashboard:', e);
        }
    },

    deleteSavedDashboard: (id: string) => {
        const state = get() as any;
        const { savedDashboards, dashboardConfig } = state;
        const updated = savedDashboards.filter((d: SavedDashboard) => d.id !== id);
        saveDashboardsToStorage(updated);
        // If deleting the currently active dashboard, close it
        if (dashboardConfig?.id === id) {
            set({
                dashboardConfig: null,
                viewMode: 'single',
                chartConfig: { ...initialChartConfig, id: uuidv4() },
                encodings: [],
                echartsOption: null,
                dashboardSummary: null,
                savedDashboards: updated,
            });
        } else {
            set({ savedDashboards: updated });
        }
    },

    renameDashboard: (title: string) => {
        const state = get() as any;
        const { dashboardConfig } = state;
        if (dashboardConfig) {
            set({
                dashboardConfig: { ...dashboardConfig, title },
            });
            (get() as any).saveDashboard();
        }
    },

    addChartToDashboard: (config?: ChartConfig) => {
        const state = get() as any;
        const { dashboardConfig, chartConfig, encodings } = state;
        if (!dashboardConfig) return;

        // Use provided config or current chart
        const newChart = config || {
            ...chartConfig,
            id: uuidv4(),
            encodings: [...encodings],
        };

        const updatedDashboard: DashboardConfig = {
            ...dashboardConfig,
            charts: [...dashboardConfig.charts, newChart],
            layout: {
                ...dashboardConfig.layout,
                items: [
                    ...dashboardConfig.layout.items,
                    {
                        chartId: newChart.id,
                        col: dashboardConfig.charts.length % dashboardConfig.layout.cols,
                        row: Math.floor(dashboardConfig.charts.length / dashboardConfig.layout.cols),
                        colSpan: 1,
                        rowSpan: 1,
                    },
                ],
            },
        };

        set({ dashboardConfig: updatedDashboard });
        (get() as any).saveDashboard();
    },

    removeChartFromDashboard: (chartId: string) => {
        const state = get() as any;
        const { dashboardConfig, crossFilters } = state;
        if (!dashboardConfig) return;

        const updatedCharts = dashboardConfig.charts.filter((c: ChartConfig) => c.id !== chartId);
        const updatedItems = dashboardConfig.layout.items.filter((i: any) => i.chartId !== chartId);

        // Clear any cross-filters from the removed chart
        const updatedCrossFilters = crossFilters.filter((f: CrossFilter) => f.sourceChartId !== chartId);

        set({
            dashboardConfig: {
                ...dashboardConfig,
                charts: updatedCharts,
                layout: {
                    ...dashboardConfig.layout,
                    items: updatedItems,
                },
            },
            crossFilters: updatedCrossFilters,
        });
        (get() as any).saveDashboard();
    },

    duplicateChartInDashboard: (chartId: string) => {
        const state = get() as any;
        const { dashboardConfig } = state;
        if (!dashboardConfig) return;

        const chartToDuplicate = dashboardConfig.charts.find((c: ChartConfig) => c.id === chartId);
        if (!chartToDuplicate) return;

        const duplicatedChart: ChartConfig = {
            ...chartToDuplicate,
            id: uuidv4(),
            title: `${chartToDuplicate.title || 'Chart'} (Copy)`,
        };

        (get() as any).addChartToDashboard(duplicatedChart);
    },

    editChartFromDashboard: (chartId: string) => {
        const state = get() as any;
        const { dashboardConfig } = state;
        if (!dashboardConfig) return;

        const chartToEdit = dashboardConfig.charts.find((c: ChartConfig) => c.id === chartId);
        if (!chartToEdit) return;

        // Load chart into editor and track which chart is being edited
        set({
            chartConfig: { ...chartToEdit },
            encodings: [...chartToEdit.encodings],
            viewMode: 'single',
            editingChartId: chartId,
            aiFocusedChartId: chartId,  // Scope AI chat to this chart
            aiChatHistory: [],           // Fresh chat for this chart context
            chartSummary: null,
            aiInsights: [],
        });
        (get() as any).regenerateSpec();
    },

    updateChartInDashboard: (chartId: string) => {
        const state = get() as any;
        const { dashboardConfig, chartConfig, encodings } = state;
        if (!dashboardConfig) return;

        const updatedCharts = dashboardConfig.charts.map((c: ChartConfig) => {
            if (c.id === chartId) {
                return { ...chartConfig, id: chartId, encodings: [...encodings] };
            }
            return c;
        });

        set({
            dashboardConfig: { ...dashboardConfig, charts: updatedCharts },
        });
        (get() as any).saveDashboard();
    },

    syncAndReturnToDashboard: () => {
        const state = get() as any;
        const { editingChartId, dashboardConfig } = state;

        if (!dashboardConfig) return;

        // If we were editing a chart from dashboard, sync changes
        if (editingChartId) {
            (get() as any).updateChartInDashboard(editingChartId);
        }

        // Return to dashboard and clear editing state, reset single chart
        set({
            viewMode: 'dashboard',
            editingChartId: null,
            aiFocusedChartId: null,
            aiChatHistory: [],
            chartConfig: { ...initialChartConfig, id: uuidv4() },
            encodings: [],
            echartsOption: null,
        });
    },

    setCrossFilter: (filter: CrossFilter) => {
        const state = get() as any;
        const { crossFilters } = state;

        // Toggle off if clicking the same value from the same chart and field
        const existing = crossFilters.find(
            (f: CrossFilter) => f.sourceChartId === filter.sourceChartId && f.field === filter.field && f.value === filter.value
        );

        if (existing) {
            // Remove this filter (toggle off)
            set({ crossFilters: crossFilters.filter((f: CrossFilter) => f !== existing) });
        } else {
            // Replace any filter from the same source chart, then add new one
            const filtered = crossFilters.filter((f: CrossFilter) => f.sourceChartId !== filter.sourceChartId);
            set({ crossFilters: [...filtered, filter] });
        }
    },

    clearCrossFilters: () => {
        set({ crossFilters: [] });
    },

    toggleCrossFilter: () => {
        const state = get() as any;
        const { crossFilterEnabled } = state;
        set({ crossFilterEnabled: !crossFilterEnabled });
        if (crossFilterEnabled) {
            // If disabling, clear active filters
            set({ crossFilters: [] });
        }
    },
});
