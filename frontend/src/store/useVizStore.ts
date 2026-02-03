// ============================================
// OpenViz Store - Central State Management
// Using Zustand for lightweight, performant state
// Enhanced with History, Dashboard, and AI Context
// ============================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
    Dataset,
    FieldInfo,
    ShelfPlacement,
    ChartConfig,
    MarkType,
    EncodingChannel,
    EChartsOption,
    DataRecord,
    UploadStatus,
    CanvasViewMode,
    ChartSuggestion,
    DataInsight,
    DataProfile,
    AIMessage,
    DashboardConfig,
    SavedDashboard,
    ChartSummary,
    DashboardSummary,
    ChartRecommendation,
    FilterSpec,
    ReportData,
    ComparisonSpec,
    ComparisonResult,
    ForecastResult,
} from '@backend/types';
import { inferSchema } from '@backend/utils/schemaInference';
import { buildEChartsOption } from '@backend/utils/echartsOptionBuilder';
import { getChartSuggestions } from '@backend/utils/autoChart';
import { generateDataProfile } from '@backend/services/dataContextService';

// ============================================
// Store Interface
// ============================================

// ============================================
// History State (for Undo/Redo)
// ============================================

interface HistoryEntry {
    encodings: ShelfPlacement[];
    chartConfig: ChartConfig;
    echartsOption: EChartsOption | null;
}

interface HistoryState {
    past: HistoryEntry[];
    future: HistoryEntry[];
}

// ============================================
// Main Store Interface
// ============================================

interface VizState {
    // Data
    dataset: Dataset | null;
    uploadStatus: UploadStatus;
    dataProfile: DataProfile | null;

    // Encodings
    encodings: ShelfPlacement[];

    // Chart Configuration
    chartConfig: ChartConfig;

    // Dashboard Configuration (for multi-chart views)
    dashboardConfig: DashboardConfig | null;
    savedDashboards: SavedDashboard[];
    viewMode: 'single' | 'dashboard';
    editingChartId: string | null;  // Track which chart is being edited from dashboard

    // Generated ECharts Option
    echartsOption: EChartsOption | null;

    // History (Undo/Redo)
    history: HistoryState;

    // UI State
    canvasView: CanvasViewMode;
    selectedFieldId: string | null;
    isDragging: boolean;
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    showAnnotations: boolean;

    // AI State
    aiQuery: string;
    aiChatOpen: boolean; // Added control for chat visibility
    aiFocusedChartId: string | null; // Chart focused in AI chat (from dashboard)
    aiLoading: boolean;
    aiSuggestions: ChartSuggestion[];
    aiInsights: DataInsight[];
    aiChatHistory: AIMessage[];

    // Summary State
    chartSummary: ChartSummary | null;
    dashboardSummary: DashboardSummary | null;
    summaryLoading: boolean;

    // Recommendations
    chartRecommendations: ChartRecommendation[];
    recommendationsLoading: boolean;

    // Filters
    activeFilters: FilterSpec | null;
    filteredData: DataRecord[] | null;

    // Reports
    reportData: ReportData | null;
    reportLoading: boolean;
    showReportModal: boolean;

    // Comparison
    comparisonMode: boolean;
    comparisonSpec: ComparisonSpec | null;
    comparisonResult: ComparisonResult | null;

    // Forecast
    forecastData: ForecastResult | null;
    forecastLoading: boolean;
}

interface VizActions {
    // Data Actions
    loadDataFromFile: (file: File) => Promise<void>;
    loadDataFromJson: (data: DataRecord[], name: string) => void;
    clearData: () => void;

    // Encoding Actions
    addToShelf: (field: FieldInfo, channel: EncodingChannel) => void;
    removeFromShelf: (channel: EncodingChannel) => void;
    updateShelfConfig: (
        channel: EncodingChannel,
        config: Partial<Pick<ShelfPlacement, 'aggregate' | 'bin' | 'timeUnit' | 'sort'>>
    ) => void;
    clearAllShelves: () => void;
    swapChannels: (from: EncodingChannel, to: EncodingChannel) => void;

    // Chart Actions
    setMark: (mark: MarkType) => void;
    setTitle: (title: string) => void;
    setDimensions: (width: number | 'container', height: number | 'container') => void;
    resetChart: () => void;

    // UI Actions
    setCanvasView: (view: CanvasViewMode) => void;
    setSelectedField: (fieldId: string | null) => void;
    setDragging: (isDragging: boolean) => void;
    toggleAnnotations: () => void;

    // AI Actions
    setAIQuery: (query: string) => void;
    processAIQuery: (query: string) => Promise<void>;
    applySuggestion: (suggestion: ChartSuggestion) => void;
    generateInsights: () => Promise<void>;
    addChatMessage: (message: AIMessage) => void;
    clearChatHistory: () => void;
    setAIChatOpen: (isOpen: boolean) => void;
    toggleAIChat: () => void;
    openChatForChart: (chartId: string) => void;
    clearChatFocus: () => void;

    // Summary Actions
    generateChartSummary: () => Promise<void>;
    generateDashboardSummary: () => Promise<void>;
    clearSummaries: () => void;

    // History Actions (Undo/Redo)
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    pushToHistory: () => void;

    // Dashboard Actions
    setDashboardConfig: (config: DashboardConfig | null) => void;
    setViewMode: (mode: 'single' | 'dashboard') => void;
    createDashboard: (title?: string) => void;
    closeDashboard: () => void;
    deleteDashboard: () => void;
    saveDashboard: () => void;
    loadDashboard: (id: string) => void;
    deleteSavedDashboard: (id: string) => void;
    renameDashboard: (title: string) => void;
    addChartToDashboard: (config?: ChartConfig) => void;
    removeChartFromDashboard: (chartId: string) => void;
    duplicateChartInDashboard: (chartId: string) => void;
    editChartFromDashboard: (chartId: string) => void;
    updateChartInDashboard: (chartId: string) => void;
    syncAndReturnToDashboard: () => void;

    // Sidebar Actions
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;

    // Spec Actions
    updateSpecFromJson: (option: EChartsOption) => void;
    regenerateSpec: () => void;

    // Recommendation Actions
    generateRecommendations: () => void;
    applyRecommendation: (rec: ChartRecommendation) => void;
    dismissRecommendation: (id: string) => void;

    // Filter Actions
    applyFilter: (spec: FilterSpec) => void;
    clearFilters: () => void;

    // Report Actions
    generateReport: () => Promise<void>;
    downloadReport: () => void;
    setShowReportModal: (show: boolean) => void;

    // Comparison Actions
    applyComparison: (spec: ComparisonSpec) => void;
    clearComparison: () => void;

    // Forecast Actions
    generateForecast: (periods?: number) => Promise<void>;
    clearForecast: () => void;
}

// ============================================
// Initial State
// ============================================

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

const initialChartConfig: ChartConfig = {
    id: uuidv4(),
    mark: 'auto',
    encodings: [],
    width: 'container',
    height: 400,
    interactive: true,
};

const initialState: VizState = {
    // Data
    dataset: null,
    uploadStatus: { state: 'idle', progress: 0 },
    dataProfile: null,

    // Chart/Encoding
    encodings: [],
    chartConfig: initialChartConfig,
    echartsOption: null,

    // Dashboard
    dashboardConfig: null,
    savedDashboards: loadDashboardsFromStorage(),
    viewMode: 'single',
    editingChartId: null,

    // History
    history: { past: [], future: [] },

    // UI
    canvasView: 'chart',
    selectedFieldId: null,
    isDragging: false,
    leftSidebarOpen: true,
    rightSidebarOpen: true,
    showAnnotations: true,

    // AI
    aiQuery: '',
    aiLoading: false,
    aiSuggestions: [],
    aiInsights: [],
    aiChatHistory: [],
    aiChatOpen: false,
    aiFocusedChartId: null,

    // Summaries
    chartSummary: null,
    dashboardSummary: null,
    summaryLoading: false,

    // Recommendations
    chartRecommendations: [],
    recommendationsLoading: false,

    // Filters
    activeFilters: null,
    filteredData: null,

    // Reports
    reportData: null,
    reportLoading: false,
    showReportModal: false,

    // Comparison
    comparisonMode: false,
    comparisonSpec: null,
    comparisonResult: null,

    // Forecast
    forecastData: null,
    forecastLoading: false,
};

// ============================================
// Store Creation
// ============================================

export const useVizStore = create<VizState & VizActions>()(
    devtools(
        (set, get) => ({
            ...initialState,

            // ----------------------------------------
            // Data Actions
            // ----------------------------------------

            loadDataFromFile: async (file: File) => {
                set({
                    uploadStatus: { state: 'uploading', progress: 0 }
                });

                try {
                    const extension = file.name.split('.').pop()?.toLowerCase();
                    let data: DataRecord[] = [];

                    if (extension === 'csv' || extension === 'tsv') {
                        data = await parseCSV(file);
                    } else if (extension === 'json') {
                        data = await parseJSON(file);
                    } else if (extension === 'xlsx' || extension === 'xls') {
                        data = await parseExcel(file);
                    } else {
                        throw new Error(`Unsupported file type: ${extension}`);
                    }

                    set({
                        uploadStatus: { state: 'processing', progress: 50 }
                    });

                    // Infer schema
                    const fields = inferSchema(data);

                    const dataset: Dataset = {
                        id: uuidv4(),
                        name: file.name,
                        fields,
                        rowCount: data.length,
                        data,
                        uploadedAt: new Date(),
                    };

                    // Clear old dashboards — they reference fields from previous dataset
                    saveDashboardsToStorage([]);

                    set({
                        dataset,
                        dataProfile: generateDataProfile(data, fields),
                        uploadStatus: { state: 'complete', progress: 100 },
                        encodings: [],
                        vegaSpec: null,
                        savedDashboards: [],
                        dashboardConfig: null,
                        viewMode: 'single',
                        editingChartId: null,
                    });

                    // Generate AI suggestions after loading
                    const suggestions = getChartSuggestions([]).map((s) => ({
                        id: uuidv4(),
                        title: `Suggested: ${s.mark} chart`,
                        description: s.reason,
                        config: { ...initialChartConfig, mark: s.mark },
                        score: s.score,
                    }));

                    set({ aiSuggestions: suggestions });

                    // Generate chart recommendations
                    get().generateRecommendations();

                } catch (error) {
                    set({
                        uploadStatus: {
                            state: 'error',
                            progress: 0,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                    });
                }
            },

            loadDataFromJson: (data: DataRecord[], name: string) => {
                const fields = inferSchema(data);

                const dataset: Dataset = {
                    id: uuidv4(),
                    name,
                    fields,
                    rowCount: data.length,
                    data,
                    uploadedAt: new Date(),
                };

                set({
                    dataset,
                    uploadStatus: { state: 'complete', progress: 100 },
                    encodings: [],
                    vegaSpec: null,
                });
            },

            clearData: () => {
                set({
                    dataset: null,
                    uploadStatus: { state: 'idle', progress: 0 },
                    encodings: [],
                    vegaSpec: null,
                    aiSuggestions: [],
                    aiInsights: [],
                });
            },

            // ----------------------------------------
            // Encoding Actions
            // ----------------------------------------

            addToShelf: (field: FieldInfo, channel: EncodingChannel) => {
                const { encodings, dataset } = get();

                // Remove any existing placement in this channel
                const filteredEncodings = encodings.filter(e => e.channel !== channel);

                // Remove this field from any other channel
                const withoutField = filteredEncodings.filter(
                    e => e.field.id !== field.id
                );

                const newPlacement: ShelfPlacement = {
                    id: uuidv4(),
                    field,
                    channel,
                };

                const newEncodings = [...withoutField, newPlacement];

                set({ encodings: newEncodings });

                // Regenerate spec
                if (dataset) {
                    get().regenerateSpec();
                }
            },

            removeFromShelf: (channel: EncodingChannel) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.filter(e => e.channel !== channel);

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            updateShelfConfig: (channel, config) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.map(e =>
                    e.channel === channel ? { ...e, ...config } : e
                );

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            clearAllShelves: () => {
                set({ encodings: [], echartsOption: null });
            },

            swapChannels: (from: EncodingChannel, to: EncodingChannel) => {
                const { encodings, dataset } = get();
                const newEncodings = encodings.map(e => {
                    if (e.channel === from) return { ...e, channel: to };
                    if (e.channel === to) return { ...e, channel: from };
                    return e;
                });

                set({ encodings: newEncodings });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            // ----------------------------------------
            // Chart Actions
            // ----------------------------------------

            setMark: (mark: MarkType) => {
                const { chartConfig, dataset } = get();
                set({
                    chartConfig: { ...chartConfig, mark },
                });

                if (dataset) {
                    get().regenerateSpec();
                }
            },

            setTitle: (title: string) => {
                const { chartConfig } = get();
                set({
                    chartConfig: { ...chartConfig, title },
                });
                get().regenerateSpec();
            },

            setDimensions: (width, height) => {
                const { chartConfig } = get();
                set({
                    chartConfig: { ...chartConfig, width, height },
                });
                get().regenerateSpec();
            },

            resetChart: () => {
                set({
                    chartConfig: { ...initialChartConfig, id: uuidv4() },
                    encodings: [],
                    echartsOption: null,
                    chartSummary: null,
                    aiInsights: [],
                });
            },

            // ----------------------------------------
            // UI Actions
            // ----------------------------------------

            setCanvasView: (view: CanvasViewMode) => {
                set({ canvasView: view });
            },

            setSelectedField: (fieldId: string | null) => {
                set({ selectedFieldId: fieldId });
            },

            setDragging: (isDragging: boolean) => {
                set({ isDragging });
            },

            toggleAnnotations: () => {
                const { showAnnotations } = get();
                set({ showAnnotations: !showAnnotations });
                // Regenerate chart to apply/remove annotations
                get().regenerateSpec();
            },

            // ----------------------------------------
            // AI Actions
            // ----------------------------------------

            setAIQuery: (query: string) => {
                set({ aiQuery: query });
            },

            processAIQuery: async (query: string) => {
                const { dataset, dataProfile, encodings, aiChatHistory } = get();

                if (!dataset || !dataProfile) {
                    console.error('No dataset or data profile loaded');
                    return;
                }

                set({ aiLoading: true, aiQuery: query });

                // Add user message to chat history
                const userMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'user',
                    content: query,
                    timestamp: new Date(),
                };
                get().addChatMessage(userMessage);

                try {
                    // Use the enhanced AI service
                    const { processAIQuery } = await import('@backend/services/groqService');
                    const { dashboardConfig, chartConfig, aiFocusedChartId } = get();

                    // If chat is focused on a specific chart in a dashboard, use that chart's context
                    let contextMark = chartConfig?.mark || 'bar';
                    let contextTitle = chartConfig?.title;
                    let contextEncodings = encodings;
                    let focusedChartConfig: ChartConfig | undefined;

                    if (aiFocusedChartId && dashboardConfig) {
                        focusedChartConfig = dashboardConfig.charts.find(c => c.id === aiFocusedChartId);
                        if (focusedChartConfig) {
                            contextMark = focusedChartConfig.mark;
                            contextTitle = focusedChartConfig.title;
                            contextEncodings = focusedChartConfig.encodings;
                        }
                    }

                    const result = await processAIQuery(
                        query,
                        dataProfile,
                        dataset.fields,
                        dataset.data,
                        contextEncodings,
                        aiChatHistory,
                        dashboardConfig,
                        contextMark,
                        contextTitle,
                        aiFocusedChartId // pass focused chart id for targeted modifications
                    );

                    // Handle based on intent
                    if (result.intent === 'question' && result.textAnswer) {
                        // Text answer for data questions
                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer,
                            timestamp: new Date(),
                            resultType: 'text',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.chartConfig) {
                        // Chart creation or modification
                        get().pushToHistory(); // Save for undo

                        const { dashboardConfig, viewMode, aiFocusedChartId: focusId } = get();

                        if (focusId && dashboardConfig) {
                            // AI is modifying a specific chart in the dashboard
                            const updatedChart = { ...result.chartConfig!, id: focusId, encodings: result.chartConfig!.encodings };
                            const updatedCharts = dashboardConfig.charts.map(c =>
                                c.id === focusId ? updatedChart : c
                            );
                            set({
                                dashboardConfig: { ...dashboardConfig, charts: updatedCharts },
                            });
                            get().saveDashboard();

                            // If this chart is maximized (editing in single view), also update the live preview
                            const { editingChartId } = get();
                            if (editingChartId === focusId) {
                                set({
                                    chartConfig: updatedChart,
                                    encodings: [...updatedChart.encodings],
                                });
                                get().regenerateSpec();
                            }

                            const chartName = result.chartConfig.title || dashboardConfig.charts.find(c => c.id === focusId)?.title || 'chart';
                            const assistantMessage: AIMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: result.textAnswer || `Updated "${chartName}" in dashboard`,
                                timestamp: new Date(),
                                resultType: 'chart',
                                chartConfig: result.chartConfig,
                                echartsOption: editingChartId === focusId ? get().echartsOption || undefined : undefined,
                            };
                            get().addChatMessage(assistantMessage);
                        } else if (viewMode === 'dashboard' && dashboardConfig) {
                            // Add chart to dashboard
                            get().addChartToDashboard(result.chartConfig);

                            const assistantMessage: AIMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: result.textAnswer || `Added ${result.chartConfig.mark} chart to dashboard`,
                                timestamp: new Date(),
                                resultType: 'chart',
                            };
                            get().addChatMessage(assistantMessage);
                        } else {
                            // Normal chart creation in single mode
                            set({
                                chartConfig: result.chartConfig,
                                encodings: result.chartConfig.encodings,
                            });
                            get().regenerateSpec();

                            // Get the generated ECharts option for transparency mode
                            const generatedOption = get().echartsOption;

                            const assistantMessage: AIMessage = {
                                id: uuidv4(),
                                role: 'assistant',
                                content: result.textAnswer || `Created ${result.chartConfig.mark} chart`,
                                timestamp: new Date(),
                                resultType: 'chart',
                                chartConfig: result.chartConfig,
                                echartsOption: generatedOption || undefined,
                            };
                            get().addChatMessage(assistantMessage);
                        }
                    } else if (result.dashboardConfig) {
                        // Dashboard creation — save previous dashboard if any
                        const { dashboardConfig: prevDashboard } = get();
                        if (prevDashboard) {
                            get().saveDashboard();
                        }

                        set({
                            dashboardConfig: result.dashboardConfig,
                            viewMode: 'dashboard',
                            editingChartId: null,
                            chartConfig: { ...initialChartConfig, id: uuidv4() },
                            encodings: [],
                            echartsOption: null,
                        });
                        get().saveDashboard();

                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer || 'Created dashboard',
                            timestamp: new Date(),
                            resultType: 'dashboard',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.error) {
                        const errorMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: `Error: ${result.error}`,
                            timestamp: new Date(),
                            resultType: 'error',
                        };
                        get().addChatMessage(errorMessage);
                    }

                    // Handle filter result
                    if (result.filterSpec) {
                        get().applyFilter(result.filterSpec);
                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer || 'Filter applied',
                            timestamp: new Date(),
                            resultType: 'text',
                        };
                        get().addChatMessage(assistantMessage);
                    }

                    // Handle comparison result
                    if (result.comparisonSpec && result.comparisonResult) {
                        set({
                            comparisonMode: true,
                            comparisonSpec: result.comparisonSpec,
                            comparisonResult: result.comparisonResult,
                        });
                    }

                    // Handle forecast result
                    if (result.forecastResult) {
                        set({ forecastData: result.forecastResult });
                        // Regenerate spec if chart was also created
                        if (result.chartConfig) {
                            get().regenerateSpec();
                        }
                    }

                    if (result.insights) {
                        set({ aiInsights: result.insights });
                    }

                } catch (error) {
                    console.error('AI Query Error:', error);
                    const errorMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        timestamp: new Date(),
                        resultType: 'error',
                    };
                    get().addChatMessage(errorMessage);
                } finally {
                    set({ aiLoading: false });
                }
            },

            applySuggestion: (suggestion: ChartSuggestion) => {
                set({
                    chartConfig: suggestion.config,
                    encodings: suggestion.config.encodings,
                });
                get().regenerateSpec();
            },

            generateInsights: async () => {
                set({ aiLoading: true });

                try {
                    const { generateDataInsights } = await import('@backend/services/groqService');
                    const { dataset } = get();

                    if (!dataset) {
                        throw new Error('No dataset loaded');
                    }

                    const insights = await generateDataInsights(dataset.data, dataset.fields);
                    set({ aiInsights: insights });

                } catch (error) {
                    console.error('Generate Insights Error:', error);
                } finally {
                    set({ aiLoading: false });
                }
            },

            addChatMessage: (message: AIMessage) => {
                set((state) => ({ aiChatHistory: [...state.aiChatHistory, message] }));
            },

            clearChatHistory: () => set({ aiChatHistory: [] }),

            setAIChatOpen: (isOpen) => set({ aiChatOpen: isOpen }),

            toggleAIChat: () => set((state) => ({ aiChatOpen: !state.aiChatOpen })),

            openChatForChart: (chartId: string) => {
                set({
                    aiChatOpen: true,
                    aiFocusedChartId: chartId,
                    aiChatHistory: [], // Fresh chat for this chart context
                });
            },

            clearChatFocus: () => {
                set({ aiFocusedChartId: null });
            },

            // ----------------------------------------
            // Summary Actions
            // ----------------------------------------

            generateChartSummary: async () => {
                const { dataset, dataProfile, chartConfig, encodings } = get();

                if (!dataset || !dataProfile || encodings.length === 0) {
                    console.error('Cannot generate summary: no chart configured');
                    return;
                }

                set({ summaryLoading: true });

                try {
                    const { generateChartSummary } = await import('@backend/services/groqService');
                    const configWithEncodings = { ...chartConfig, encodings };
                    const result = await generateChartSummary(configWithEncodings, dataProfile, dataset.data);

                    const summary: ChartSummary = {
                        id: uuidv4(),
                        chartId: chartConfig.id,
                        summary: result.summary,
                        keyInsights: result.keyInsights,
                        generatedAt: new Date(),
                    };

                    set({ chartSummary: summary });
                } catch (error) {
                    console.error('Chart Summary Error:', error);
                } finally {
                    set({ summaryLoading: false });
                }
            },

            generateDashboardSummary: async () => {
                const { dataset, dataProfile, dashboardConfig } = get();

                if (!dataset || !dataProfile || !dashboardConfig) {
                    console.error('Cannot generate summary: no dashboard configured');
                    return;
                }

                set({ summaryLoading: true });

                try {
                    const { generateDashboardSummary } = await import('@backend/services/groqService');
                    const result = await generateDashboardSummary(dashboardConfig, dataProfile, dataset.data);

                    // Check if the result is an error - look for the specific error message
                    if (result.overview.includes('Failed to generate')) {
                        console.error('Dashboard summary generation failed:', result.overview);
                        // Don't update the summary if it's an error - keep existing summary
                        return;
                    }

                    const chartSummaries: ChartSummary[] = result.chartSummaries.map(cs => ({
                        id: uuidv4(),
                        chartId: cs.chartId,
                        summary: cs.summary,
                        keyInsights: [],
                        generatedAt: new Date(),
                    }));

                    const summary: DashboardSummary = {
                        id: uuidv4(),
                        dashboardId: dashboardConfig.id,
                        overview: result.overview,
                        chartSummaries,
                        keyTakeaways: result.keyTakeaways,
                        generatedAt: new Date(),
                    };

                    set({ dashboardSummary: summary });
                } catch (error) {
                    console.error('Dashboard Summary Error:', error);
                    // Don't update state on error - keep existing summary
                } finally {
                    set({ summaryLoading: false });
                }
            },

            clearSummaries: () => {
                set({ chartSummary: null, dashboardSummary: null });
            },

            // ----------------------------------------
            // History Actions (Undo/Redo)
            // ----------------------------------------

            pushToHistory: () => {
                const { encodings, chartConfig, echartsOption, history } = get();
                const entry: HistoryEntry = { encodings, chartConfig, echartsOption };

                set({
                    history: {
                        past: [...history.past, entry].slice(-50), // Keep max 50 entries
                        future: [], // Clear redo stack on new action
                    }
                });
            },

            undo: () => {
                const { history, encodings, chartConfig, echartsOption } = get();
                if (history.past.length === 0) return;

                const previous = history.past[history.past.length - 1];
                const currentEntry: HistoryEntry = { encodings, chartConfig, echartsOption };

                set({
                    encodings: previous.encodings,
                    chartConfig: previous.chartConfig,
                    echartsOption: previous.echartsOption,
                    history: {
                        past: history.past.slice(0, -1),
                        future: [currentEntry, ...history.future],
                    }
                });
            },

            redo: () => {
                const { history, encodings, chartConfig, echartsOption } = get();
                if (history.future.length === 0) return;

                const next = history.future[0];
                const currentEntry: HistoryEntry = { encodings, chartConfig, echartsOption };

                set({
                    encodings: next.encodings,
                    chartConfig: next.chartConfig,
                    echartsOption: next.echartsOption,
                    history: {
                        past: [...history.past, currentEntry],
                        future: history.future.slice(1),
                    }
                });
            },

            canUndo: () => get().history.past.length > 0,
            canRedo: () => get().history.future.length > 0,

            // ----------------------------------------
            // Dashboard Actions
            // ----------------------------------------

            setDashboardConfig: (config: DashboardConfig | null) => {
                set({ dashboardConfig: config });
            },

            setViewMode: (mode: 'single' | 'dashboard') => {
                set({ viewMode: mode });
            },

            closeDashboard: () => {
                const { dashboardConfig } = get();
                if (dashboardConfig) {
                    get().saveDashboard();
                }
                set({
                    viewMode: 'single',
                    dashboardConfig: null,
                    editingChartId: null,
                    chartConfig: { ...initialChartConfig, id: uuidv4() },
                    encodings: [],
                    echartsOption: null,
                    dashboardSummary: null,
                });
            },

            createDashboard: (title?: string) => {
                const { chartConfig, encodings, dashboardConfig: existingDashboard } = get();

                // Save existing dashboard before creating new one
                if (existingDashboard) {
                    get().saveDashboard();
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
                get().saveDashboard();
            },

            deleteDashboard: () => {
                const { dashboardConfig, savedDashboards } = get();
                const dashId = dashboardConfig?.id;
                // Also remove from saved dashboards
                const updated = dashId ? savedDashboards.filter(d => d.id !== dashId) : savedDashboards;
                saveDashboardsToStorage(updated);
                set({
                    dashboardConfig: null,
                    savedDashboards: updated,
                    viewMode: 'single',
                    chartConfig: { ...initialChartConfig, id: uuidv4() },
                    encodings: [],
                    echartsOption: null,
                    dashboardSummary: null,
                });
            },

            saveDashboard: () => {
                const { dashboardConfig, savedDashboards } = get();
                if (!dashboardConfig) return;
                const entry: SavedDashboard = {
                    id: dashboardConfig.id,
                    config: dashboardConfig,
                    updatedAt: new Date(),
                };
                const exists = savedDashboards.findIndex(d => d.id === dashboardConfig.id);
                const updated = exists >= 0
                    ? savedDashboards.map(d => d.id === dashboardConfig.id ? entry : d)
                    : [...savedDashboards, entry];
                saveDashboardsToStorage(updated);
                set({ savedDashboards: updated });
            },

            loadDashboard: (id: string) => {
                const { savedDashboards, dashboardConfig: currentDashboard } = get();
                const found = savedDashboards.find(d => d.id === id);
                if (!found) return;

                // If already viewing this dashboard, just switch to dashboard view
                if (currentDashboard?.id === id) {
                    set({ viewMode: 'dashboard', editingChartId: null });
                    return;
                }

                // Save current dashboard before switching
                if (currentDashboard) {
                    get().saveDashboard();
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

            deleteSavedDashboard: (id: string) => {
                const { savedDashboards, dashboardConfig } = get();
                const updated = savedDashboards.filter(d => d.id !== id);
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
                const { dashboardConfig } = get();
                if (dashboardConfig) {
                    set({
                        dashboardConfig: { ...dashboardConfig, title },
                    });
                    get().saveDashboard();
                }
            },

            addChartToDashboard: (config?: ChartConfig) => {
                const { dashboardConfig, chartConfig, encodings } = get();
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
                get().saveDashboard();
            },

            removeChartFromDashboard: (chartId: string) => {
                const { dashboardConfig } = get();
                if (!dashboardConfig) return;

                const updatedCharts = dashboardConfig.charts.filter(c => c.id !== chartId);
                const updatedItems = dashboardConfig.layout.items.filter(i => i.chartId !== chartId);

                set({
                    dashboardConfig: {
                        ...dashboardConfig,
                        charts: updatedCharts,
                        layout: {
                            ...dashboardConfig.layout,
                            items: updatedItems,
                        },
                    },
                });
                get().saveDashboard();
            },

            duplicateChartInDashboard: (chartId: string) => {
                const { dashboardConfig } = get();
                if (!dashboardConfig) return;

                const chartToDuplicate = dashboardConfig.charts.find(c => c.id === chartId);
                if (!chartToDuplicate) return;

                const duplicatedChart: ChartConfig = {
                    ...chartToDuplicate,
                    id: uuidv4(),
                    title: `${chartToDuplicate.title || 'Chart'} (Copy)`,
                };

                get().addChartToDashboard(duplicatedChart);
            },

            editChartFromDashboard: (chartId: string) => {
                const { dashboardConfig } = get();
                if (!dashboardConfig) return;

                const chartToEdit = dashboardConfig.charts.find(c => c.id === chartId);
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
                get().regenerateSpec();
            },

            updateChartInDashboard: (chartId: string) => {
                const { dashboardConfig, chartConfig, encodings } = get();
                if (!dashboardConfig) return;

                const updatedCharts = dashboardConfig.charts.map(c => {
                    if (c.id === chartId) {
                        return { ...chartConfig, id: chartId, encodings: [...encodings] };
                    }
                    return c;
                });

                set({
                    dashboardConfig: { ...dashboardConfig, charts: updatedCharts },
                });
                get().saveDashboard();
            },

            syncAndReturnToDashboard: () => {
                const { editingChartId, dashboardConfig } = get();

                if (!dashboardConfig) return;

                // If we were editing a chart from dashboard, sync changes
                if (editingChartId) {
                    get().updateChartInDashboard(editingChartId);
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

            // ----------------------------------------
            // Sidebar Actions
            // ----------------------------------------

            toggleLeftSidebar: () => {
                set({ leftSidebarOpen: !get().leftSidebarOpen });
            },

            toggleRightSidebar: () => {
                set({ rightSidebarOpen: !get().rightSidebarOpen });
            },

            // ----------------------------------------
            // Recommendation Actions
            // ----------------------------------------

            generateRecommendations: () => {
                const { dataset } = get();
                if (!dataset) return;

                set({ recommendationsLoading: true });
                try {
                    // Dynamic import to avoid circular deps
                    import('@backend/services/recommendationService').then(({ generateRecommendations }) => {
                        const recs = generateRecommendations(dataset.fields, dataset.data, 5);
                        set({ chartRecommendations: recs, recommendationsLoading: false });
                    });
                } catch {
                    set({ recommendationsLoading: false });
                }
            },

            applyRecommendation: (rec) => {
                const { dataset } = get();
                if (!dataset) return;

                const xField = dataset.fields.find(f => f.name === rec.xField);
                const yField = dataset.fields.find(f => f.name === rec.yField);
                if (!xField || !yField) return;

                get().pushToHistory();

                const encodings: ShelfPlacement[] = [
                    { id: uuidv4(), field: xField, channel: 'x' },
                    { id: uuidv4(), field: yField, channel: 'y', aggregate: yField.type === 'quantitative' ? 'sum' : undefined },
                ];

                if (rec.colorField) {
                    const colorField = dataset.fields.find(f => f.name === rec.colorField);
                    if (colorField) {
                        encodings.push({ id: uuidv4(), field: colorField, channel: 'color' });
                    }
                }

                // Generate a short, clean title (max ~40 chars)
                const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;
                const shortTitle = `${truncate(rec.yField, 18)} by ${truncate(rec.xField, 15)}`;

                set({
                    chartConfig: { ...get().chartConfig, mark: rec.mark, title: shortTitle },
                    encodings,
                });
                get().regenerateSpec();
            },

            dismissRecommendation: (id) => {
                set((state) => ({
                    chartRecommendations: state.chartRecommendations.filter(r => r.id !== id),
                }));
            },

            // ----------------------------------------
            // Filter Actions
            // ----------------------------------------

            applyFilter: (spec) => {
                const { dataset } = get();
                if (!dataset) return;

                import('@backend/services/filterService').then(({ applyFilters }) => {
                    const filtered = applyFilters(dataset.data, spec);
                    set({ activeFilters: spec, filteredData: filtered });
                    get().regenerateSpec();
                });
            },

            clearFilters: () => {
                set({ activeFilters: null, filteredData: null });
                get().regenerateSpec();
            },

            // ----------------------------------------
            // Report Actions
            // ----------------------------------------

            generateReport: async () => {
                const { dataset, dataProfile, chartConfig, encodings, dashboardConfig, viewMode } = get();
                if (!dataset || !dataProfile) return;

                set({ reportLoading: true });

                try {
                    const { generateFullReport } = await import('@backend/services/reportService');
                    const { generateNarrative } = await import('@backend/services/groqService');

                    const charts = viewMode === 'dashboard' && dashboardConfig
                        ? dashboardConfig.charts
                        : encodings.length > 0
                            ? [{ ...chartConfig, encodings }]
                            : [];

                    const report = await generateFullReport(
                        dataProfile,
                        dataset.data,
                        charts,
                        dataset.name,
                        generateNarrative
                    );

                    set({ reportData: report, reportLoading: false, showReportModal: true });
                } catch (error) {
                    console.error('Report Generation Error:', error);
                    set({ reportLoading: false });
                }
            },

            downloadReport: () => {
                const { reportData } = get();
                if (!reportData) return;

                import('@backend/services/reportService').then(({ compileToMarkdown }) => {
                    const markdown = compileToMarkdown(reportData);
                    const blob = new Blob([markdown], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportData.datasetName.replace(/\.[^/.]+$/, '')}_report.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            },

            setShowReportModal: (show) => set({ showReportModal: show }),

            // ----------------------------------------
            // Comparison Actions
            // ----------------------------------------

            applyComparison: (spec) => {
                const { dataset } = get();
                if (!dataset) return;

                import('@backend/services/comparisonService').then(({ executeComparison }) => {
                    const result = executeComparison(dataset.data, spec);
                    set({ comparisonMode: true, comparisonSpec: spec, comparisonResult: result });
                    get().regenerateSpec();
                });
            },

            clearComparison: () => {
                set({ comparisonMode: false, comparisonSpec: null, comparisonResult: null });
                get().regenerateSpec();
            },

            // ----------------------------------------
            // Forecast Actions
            // ----------------------------------------

            generateForecast: async (periods = 6) => {
                const { dataset, encodings } = get();
                if (!dataset) return;

                const xEnc = encodings.find(e => e.channel === 'x');
                const yEnc = encodings.find(e => e.channel === 'y');
                if (!xEnc || !yEnc) return;

                set({ forecastLoading: true });

                try {
                    const { generateForecast } = await import('@backend/services/forecastService');
                    const result = generateForecast(dataset.data, xEnc.field.name, yEnc.field.name, periods);
                    set({ forecastData: result, forecastLoading: false });
                    get().regenerateSpec();
                } catch (error) {
                    console.error('Forecast Error:', error);
                    set({ forecastLoading: false });
                }
            },

            clearForecast: () => {
                set({ forecastData: null });
                get().regenerateSpec();
            },

            // ----------------------------------------
            // Spec Actions
            // ----------------------------------------

            updateSpecFromJson: (option: EChartsOption) => {
                set({ echartsOption: option });
                // TODO: Parse option back to encodings for bi-directional editing
            },

            regenerateSpec: () => {
                const { dataset, chartConfig, encodings, showAnnotations, filteredData, forecastData, comparisonResult } = get();

                if (!dataset || encodings.length === 0) {
                    set({ echartsOption: null });
                    return;
                }

                const configWithEncodings: ChartConfig = {
                    ...chartConfig,
                    encodings,
                    // Remove annotations if toggle is off
                    annotations: showAnnotations ? chartConfig.annotations : undefined,
                };

                // Use filtered data if active, otherwise full dataset
                const dataToUse = filteredData ?? dataset.data;

                let option = buildEChartsOption(configWithEncodings, dataToUse);

                // Append forecast series if present
                if (forecastData && forecastData.points.length > 0) {
                    const series = (option.series as unknown[]) || [];
                    // Dashed forecast line
                    const forecastSeries = {
                        type: 'line',
                        name: 'Forecast',
                        data: forecastData.points.map(p => [p.x, p.y]),
                        lineStyle: { type: 'dashed', width: 2, color: '#06b6d4' },
                        itemStyle: { color: '#06b6d4' },
                        symbol: 'diamond',
                        symbolSize: 6,
                    };
                    series.push(forecastSeries);

                    // Confidence interval area
                    if (forecastData.points[0]?.lower !== undefined) {
                        const ciSeries = {
                            type: 'line',
                            name: 'Confidence Interval',
                            data: forecastData.points.map(p => [p.x, p.lower, p.upper]),
                            lineStyle: { opacity: 0 },
                            areaStyle: { color: '#06b6d4', opacity: 0.1 },
                            stack: undefined,
                            symbol: 'none',
                            encode: undefined,
                        };
                        series.push(ciSeries);
                    }

                    option = { ...option, series: series as EChartsOption['series'] };
                }

                // Add comparison annotations if present
                if (comparisonResult) {
                    const series = (option.series as Record<string, unknown>[]) || [];
                    if (series.length > 0 && !series[0].markLine) {
                        series[0] = {
                            ...series[0],
                            markLine: {
                                data: [
                                    { yAxis: comparisonResult.groupA.value, name: comparisonResult.groupA.label, lineStyle: { color: '#3b82f6', type: 'dashed' } },
                                    { yAxis: comparisonResult.groupB.value, name: comparisonResult.groupB.label, lineStyle: { color: '#f59e0b', type: 'dashed' } },
                                ],
                                label: { show: true, color: '#d4d4d8', fontSize: 11 },
                            },
                        };
                    }
                    option = { ...option, series };
                }

                set({ echartsOption: option });

                // Update suggestions based on current encodings
                const suggestions = getChartSuggestions(encodings).map((s) => ({
                    id: uuidv4(),
                    title: `${s.mark.charAt(0).toUpperCase() + s.mark.slice(1)} Chart`,
                    description: s.reason,
                    config: { ...chartConfig, mark: s.mark, encodings },
                    score: s.score,
                }));

                set({ aiSuggestions: suggestions });
            },
        }),
        { name: 'openviz-store' }
    )
);

// ============================================
// Helper Functions
// ============================================

async function parseCSV(file: File): Promise<DataRecord[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data as DataRecord[]);
            },
            error: (error) => {
                reject(error);
            },
        });
    });
}

async function parseJSON(file: File): Promise<DataRecord[]> {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Handle both array and object with data property
    if (Array.isArray(parsed)) {
        return parsed;
    } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
    } else {
        throw new Error('Invalid JSON format. Expected an array or object with data property.');
    }
}

async function parseExcel(file: File): Promise<DataRecord[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error('Excel file contains no sheets.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json<DataRecord>(sheet);
}

// ============================================
// Selectors (for optimized re-renders)
// ============================================

// Stable empty array to avoid creating new references
const EMPTY_FIELDS: FieldInfo[] = [];
const EMPTY_MESSAGES: AIMessage[] = [];

// Data Selectors
export const selectDataset = (state: VizState) => state.dataset;
export const selectFields = (state: VizState) => state.dataset?.fields ?? EMPTY_FIELDS;
export const selectDataProfile = (state: VizState) => state.dataProfile;
export const selectUploadStatus = (state: VizState) => state.uploadStatus;

// Encoding Selectors
export const selectEncodings = (state: VizState) => state.encodings;
export const selectEncodingByChannel = (channel: EncodingChannel) => (state: VizState) =>
    state.encodings.find(e => e.channel === channel);
export const selectIsFieldUsed = (fieldId: string) => (state: VizState) =>
    state.encodings.some(e => e.field.id === fieldId);

// Chart Selectors
export const selectEChartsOption = (state: VizState) => state.echartsOption;
export const selectChartConfig = (state: VizState) => state.chartConfig;
export const selectCanvasView = (state: VizState) => state.canvasView;

// Dashboard Selectors
export const selectDashboardConfig = (state: VizState) => state.dashboardConfig;
export const selectSavedDashboards = (state: VizState) => state.savedDashboards;
export const selectViewMode = (state: VizState) => state.viewMode;

// History Selectors
export const selectCanUndo = (state: VizState) => state.history.past.length > 0;
export const selectCanRedo = (state: VizState) => state.history.future.length > 0;

// AI Selectors
export const selectAILoading = (state: VizState) => state.aiLoading;
export const selectAISuggestions = (state: VizState) => state.aiSuggestions;
export const selectAIChatHistory = (state: VizState) => state.aiChatHistory ?? EMPTY_MESSAGES;
export const selectAIInsights = (state: VizState) => state.aiInsights;

// Summary Selectors
export const selectChartSummary = (state: VizState) => state.chartSummary;
export const selectDashboardSummary = (state: VizState) => state.dashboardSummary;
export const selectSummaryLoading = (state: VizState) => state.summaryLoading;

// Recommendation Selectors
export const selectChartRecommendations = (state: VizState) => state.chartRecommendations;
export const selectRecommendationsLoading = (state: VizState) => state.recommendationsLoading;

// Filter Selectors
export const selectActiveFilters = (state: VizState) => state.activeFilters;
export const selectFilteredData = (state: VizState) => state.filteredData;

// Report Selectors
export const selectReportData = (state: VizState) => state.reportData;
export const selectReportLoading = (state: VizState) => state.reportLoading;
export const selectShowReportModal = (state: VizState) => state.showReportModal;

// Comparison Selectors
export const selectComparisonMode = (state: VizState) => state.comparisonMode;
export const selectComparisonResult = (state: VizState) => state.comparisonResult;

// Forecast Selectors
export const selectForecastData = (state: VizState) => state.forecastData;
export const selectForecastLoading = (state: VizState) => state.forecastLoading;

// UI Selectors
export const selectLeftSidebarOpen = (state: VizState) => state.leftSidebarOpen;
export const selectRightSidebarOpen = (state: VizState) => state.rightSidebarOpen;
export const selectFieldById = (id: string) => (state: VizState) =>
    state.dataset?.fields.find(f => f.id === id);

