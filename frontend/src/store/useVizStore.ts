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
    AIQueryObservation,
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
    CrossFilter,
    CalculatedField,
    DataSourceInfo,
    RefreshInterval,
    DrillLevel,
    DrillHierarchy,
    TemporalDrillLevel,
    DashboardTemplate,
    DashboardLayoutItem,
} from '@backend/types';
import { inferSchema } from '@backend/utils/schemaInference';
import { buildEChartsOption } from '@backend/utils/echartsOptionBuilder';
import { detectHierarchies, getDrillData, getCurrentDrillLevel } from '@backend/services/drillService';
import { getChartSuggestions } from '@backend/utils/autoChart';
import { generateDataProfile } from '@backend/services/dataContextService';
import { toast } from '@/lib/toast';

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
    dataSource: DataSourceInfo | null;
    isRefreshing: boolean;
    lastRefreshedAt: Date | null;

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
    aiStreamingMessageId: string | null; // ID of message currently being streamed
    aiStreamingText: string; // Partial text being streamed/typed
    lastFailedQuery: string | null; // For manual retry after AI failure
    aiSuggestions: ChartSuggestion[];
    aiInsights: DataInsight[];
    aiChatHistory: AIMessage[];
    aiQueryObservability: AIQueryObservation[];

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

    // Cross-Chart Filtering
    crossFilters: CrossFilter[];
    crossFilterEnabled: boolean;

    // Calculated Fields
    calculatedFields: CalculatedField[];

    // Drill-Down Navigation
    drillPath: DrillLevel[];
    drillHierarchies: DrillHierarchy[];
    drillActiveField: string | null;
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
    applyTemplate: (template: import('@/data/chartTemplates').ChartTemplate) => void;
    applyDashboardTemplate: (template: DashboardTemplate) => void;

    // UI Actions
    setCanvasView: (view: CanvasViewMode) => void;
    setSelectedField: (fieldId: string | null) => void;
    setDragging: (isDragging: boolean) => void;
    toggleAnnotations: () => void;

    // AI Actions
    setAIQuery: (query: string) => void;
    processAIQuery: (query: string) => Promise<void>;
    retryLastQuery: () => Promise<void>;
    applySuggestion: (suggestion: ChartSuggestion) => void;
    generateInsights: () => Promise<void>;
    addChatMessage: (message: AIMessage) => void;
    clearChatHistory: () => void;
    setMessageFeedback: (messageId: string, feedback: 'positive' | 'negative') => void;
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
    importDashboard: (dashboard: DashboardConfig, dataset: Dataset) => void;

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

    // Cross-Filter Actions
    setCrossFilter: (filter: CrossFilter) => void;
    clearCrossFilters: () => void;
    toggleCrossFilter: () => void;

    // Calculated Field Actions
    addCalculatedField: (name: string, formula: string) => void;
    removeCalculatedField: (fieldId: string) => void;

    // Data Source Actions
    setDataSource: (source: DataSourceInfo | null) => void;

    // Drill-Down Actions
    drillDown: (field: string, value: string | number, level: TemporalDrillLevel | string) => void;
    drillUp: () => void;
    drillReset: () => void;

    // Refresh Actions
    setRefreshInterval: (interval: RefreshInterval) => void;
    refreshDashboardData: () => Promise<void>;
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
    dataSource: null,
    isRefreshing: false,
    lastRefreshedAt: null,

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
    aiStreamingMessageId: null,
    aiStreamingText: '',
    lastFailedQuery: null,
    aiSuggestions: [],
    aiInsights: [],
    aiChatHistory: [],
    aiQueryObservability: [],
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

    // Cross-Chart Filtering
    crossFilters: [],
    crossFilterEnabled: true,

    // Calculated Fields
    calculatedFields: [],

    // Drill-Down
    drillPath: [],
    drillHierarchies: [],
    drillActiveField: null,
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

                    // Detect drill hierarchies for the new dataset
                    const hierarchies = detectHierarchies(fields, data);

                    set({
                        dataset,
                        dataProfile: generateDataProfile(data, fields),
                        uploadStatus: { state: 'complete', progress: 100 },
                        encodings: [],
                        savedDashboards: [],
                        dashboardConfig: null,
                        viewMode: 'single',
                        editingChartId: null,
                        calculatedFields: [],
                        dataSource: null,
                        drillPath: [],
                        drillHierarchies: hierarchies,
                        drillActiveField: null,
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

                    // Show success toast
                    toast.success('Data loaded successfully', {
                        description: `${data.length.toLocaleString()} rows, ${fields.length} columns from ${file.name}`,
                    });

                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    set({
                        uploadStatus: {
                            state: 'error',
                            progress: 0,
                            error: errorMsg,
                        },
                    });
                    // Show error toast
                    toast.error('Failed to load file', {
                        description: errorMsg,
                    });
                }
            },

            loadDataFromJson: (data: DataRecord[], name: string) => {
                const fields = inferSchema(data);
                const hierarchies = detectHierarchies(fields, data);

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
                    drillPath: [],
                    drillHierarchies: hierarchies,
                    drillActiveField: null,
                });
            },

            clearData: () => {
                set({
                    dataset: null,
                    uploadStatus: { state: 'idle', progress: 0 },
                    encodings: [],
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

                // Clear drill state when x-axis changes (drill path becomes invalid)
                const xChanged = channel === 'x' || encodings.find(e => e.channel === 'x')?.field.id !== newEncodings.find(e => e.channel === 'x')?.field.id;
                if (xChanged && get().drillPath.length > 0) {
                    set({ drillPath: [], drillActiveField: null });
                }

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

            applyTemplate: (template) => {
                const { dataset } = get();
                if (!dataset) return;

                // Dynamic import to avoid circular dependency
                import('@/data/chartTemplates').then(({ autoMapFields }) => {
                    const fields = dataset.fields.map(f => ({ name: f.name, type: f.type }));
                    const mapping = autoMapFields(template, fields);

                    // Build new encodings from the mapping
                    const newEncodings: ShelfPlacement[] = [];
                    for (const slot of template.slots) {
                        const mapped = mapping.get(slot.channel);
                        if (!mapped) continue;

                        // Find the full FieldInfo object
                        const fieldInfo = dataset.fields.find(f => f.name === mapped.name);
                        if (!fieldInfo) continue;

                        newEncodings.push({
                            id: uuidv4(),
                            field: fieldInfo,
                            channel: slot.channel,
                            aggregate: slot.aggregate,
                        });
                    }

                    // Apply everything at once
                    get().pushToHistory();
                    set({
                        chartConfig: {
                            ...get().chartConfig,
                            id: uuidv4(),
                            mark: template.mark,
                            title: template.name,
                            encodings: newEncodings,
                            fixedColor: template.fixedColor,
                        },
                        encodings: newEncodings,
                    });

                    get().regenerateSpec();
                });
            },

            applyDashboardTemplate: (template) => {
                const { dataset, dashboardConfig: existingDashboard } = get();
                if (!dataset) return;

                import('@/data/chartTemplates').then(({ autoMapFields, canApplyTemplate, getChartTemplateById }) => {
                    const fields = dataset.fields.map(f => ({ name: f.name, type: f.type }));

                    // Save existing dashboard before creating new one
                    if (existingDashboard) {
                        get().saveDashboard();
                    }

                    const charts: ChartConfig[] = [];
                    const layoutItems: DashboardLayoutItem[] = [];

                    for (const slot of template.chartSlots) {
                        const chartTemplate = getChartTemplateById(slot.chartTemplateId);
                        if (!chartTemplate) continue;
                        if (!canApplyTemplate(chartTemplate, fields)) continue;

                        const mapping = autoMapFields(chartTemplate, fields);
                        const encodings: ShelfPlacement[] = [];

                        for (const tSlot of chartTemplate.slots) {
                            const mapped = mapping.get(tSlot.channel);
                            if (!mapped) continue;

                            const fieldInfo = dataset.fields.find(f => f.name === mapped.name);
                            if (!fieldInfo) continue;

                            encodings.push({
                                id: uuidv4(),
                                field: fieldInfo,
                                channel: tSlot.channel,
                                aggregate: tSlot.aggregate,
                            });
                        }

                        if (encodings.length === 0) continue;

                        const chartId = uuidv4();
                        charts.push({
                            id: chartId,
                            title: slot.suggestedTitle,
                            mark: chartTemplate.mark,
                            encodings,
                            width: 'container',
                            height: 'container',
                            interactive: true,
                            fixedColor: chartTemplate.fixedColor,
                        });

                        layoutItems.push({
                            chartId,
                            col: slot.layout.col,
                            row: slot.layout.row,
                            colSpan: slot.layout.colSpan,
                            rowSpan: slot.layout.rowSpan,
                        });
                    }

                    if (charts.length === 0) return;

                    // Re-compact layout if some charts were skipped
                    const compactedItems: DashboardLayoutItem[] = [];
                    let idx = 0;
                    for (const item of layoutItems) {
                        compactedItems.push({
                            ...item,
                            col: idx % template.cols,
                            row: Math.floor(idx / template.cols),
                            // Keep original colSpan — if it was full-width, keep it
                            colSpan: item.colSpan > 1 ? template.cols : 1,
                        });
                        idx += item.colSpan > 1 ? template.cols : 1;
                    }

                    const newDashboard: DashboardConfig = {
                        id: uuidv4(),
                        title: template.name,
                        charts,
                        layout: {
                            cols: template.cols,
                            rows: 10,
                            items: compactedItems,
                        },
                        createdAt: new Date(),
                    };

                    set({
                        dashboardConfig: newDashboard,
                        viewMode: 'dashboard',
                        editingChartId: null,
                        aiFocusedChartId: null,
                        chartConfig: { ...initialChartConfig, id: uuidv4() },
                        encodings: [],
                        echartsOption: null,
                    });
                    get().saveDashboard();
                    toast.success(`Created "${template.name}" with ${charts.length} charts`);
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

                const queryStartedAt = new Date();
                const queryStartMs = Date.now();
                const recordObservation = (params: {
                    intent: AIQueryObservation['intent'];
                    provider?: string;
                    success: boolean;
                    failureReason?: string;
                    tokenUsage?: AIQueryObservation['tokenUsage'];
                }) => {
                    const completedAt = new Date();
                    const observation: AIQueryObservation = {
                        id: uuidv4(),
                        query,
                        intent: params.intent,
                        provider: params.provider,
                        startedAt: queryStartedAt,
                        completedAt,
                        latencyMs: completedAt.getTime() - queryStartMs,
                        success: params.success,
                        failureReason: params.failureReason,
                        tokenUsage: params.tokenUsage,
                    };

                    set((state) => ({
                        aiQueryObservability: [...state.aiQueryObservability, observation].slice(-200),
                    }));
                };

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
                    // Use the streaming AI service for real-time text responses
                    const { processAIQueryStreaming, getLastTokenUsage } = await import('@backend/services/groqService');
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

                    // Create a streaming message placeholder before calling AI
                    // This allows streaming callbacks to populate it progressively
                    const streamMsgId = uuidv4();
                    let isStreamingActive = false;

                    const onChunk = (_chunk: string, accumulated: string) => {
                        // On first chunk, set up the streaming message if not already done
                        if (!isStreamingActive) {
                            isStreamingActive = true;
                            const streamMessage: AIMessage = {
                                id: streamMsgId,
                                role: 'assistant',
                                content: '',
                                timestamp: new Date(),
                                resultType: 'text',
                            };
                            get().addChatMessage(streamMessage);
                            set({ aiStreamingMessageId: streamMsgId, aiStreamingText: '' });
                        }

                        // Update streaming text and the message in chat history
                        set({ aiStreamingText: accumulated });
                        const history = get().aiChatHistory;
                        set({
                            aiChatHistory: history.map(m =>
                                m.id === streamMsgId ? { ...m, content: accumulated } : m
                            ),
                        });
                    };

                    const result = await processAIQueryStreaming(
                        query,
                        dataProfile,
                        dataset.fields,
                        dataset.data,
                        contextEncodings,
                        aiChatHistory,
                        dashboardConfig,
                        contextMark,
                        contextTitle,
                        aiFocusedChartId,
                        onChunk
                    );
                    const tokenUsage = getLastTokenUsage() || undefined;

                    // If the response was streamed, finalize the streaming state
                    if (result.streamed && result.textAnswer) {
                        const finalHistory = get().aiChatHistory;
                        set({
                            aiChatHistory: finalHistory.map(m =>
                                m.id === streamMsgId ? { ...m, content: result.textAnswer!, provider: result.provider } : m
                            ),
                            aiStreamingMessageId: null,
                            aiStreamingText: '',
                        });
                    } else if (result.streamed && result.error) {
                        // Streamed intent that errored - show error
                        // Clean up partial streaming message if it was added
                        if (isStreamingActive) {
                            const h = get().aiChatHistory;
                            set({
                                aiChatHistory: h.filter(m => m.id !== streamMsgId),
                                aiStreamingMessageId: null,
                                aiStreamingText: '',
                            });
                        }
                        const errorMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: `Error: ${result.error}`,
                            timestamp: new Date(),
                            resultType: 'error',
                        };
                        get().addChatMessage(errorMessage);
                    } else if (!result.streamed && result.intent === 'question' && result.textAnswer) {
                        // Fallback: non-streamed text answer (shouldn't happen, but just in case)
                        const msgId = uuidv4();
                        const assistantMessage: AIMessage = {
                            id: msgId,
                            role: 'assistant',
                            content: result.textAnswer,
                            timestamp: new Date(),
                            resultType: 'text',
                        };
                        get().addChatMessage(assistantMessage);
                    } else if (result.deleteChart) {
                        // Delete/clear the current chart
                        get().pushToHistory(); // Save for undo
                        get().resetChart();

                        const assistantMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: result.textAnswer || 'Chart has been removed.',
                            timestamp: new Date(),
                            resultType: 'text',
                            provider: result.provider,
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
                                provider: result.provider,
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
                                provider: result.provider,
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
                                provider: result.provider,
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
                            provider: result.provider,
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
                        const filterText = result.textAnswer || 'Filter applied';
                        const filterMessage: AIMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: filterText,
                            timestamp: new Date(),
                            resultType: 'text',
                        };
                        get().addChatMessage(filterMessage);
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

                    recordObservation({
                        intent: result.intent,
                        provider: result.provider,
                        success: !result.error,
                        failureReason: result.error,
                        tokenUsage,
                    });

                    // Clear last failed query on success
                    set({ lastFailedQuery: null });

                } catch (error) {
                    console.error('AI Query Error:', error);
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                    // Store the failed query for retry
                    set({ lastFailedQuery: query });

                    // Create user-friendly error message
                    const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch');
                    const isRateLimitError = errorMsg.includes('429') || errorMsg.includes('rate limit');
                    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('timed out');

                    let friendlyMessage = 'Sorry, I encountered an error processing your request.';
                    if (isNetworkError) {
                        friendlyMessage = 'Unable to connect to the AI service. Please check your internet connection and try again.';
                    } else if (isRateLimitError) {
                        friendlyMessage = 'The AI service is temporarily busy. Please wait a moment and try again.';
                    } else if (isTimeout) {
                        friendlyMessage = 'The request took too long to complete. Please try a simpler query or try again.';
                    } else if (errorMsg.includes('API key')) {
                        friendlyMessage = 'AI service is not configured. Please check your API key settings.';
                    } else if (errorMsg.includes('JSON') || errorMsg.includes('parse') || errorMsg.includes('invalid') || errorMsg.includes('unexpected')) {
                        friendlyMessage = 'The AI generated an unexpected response. Try rephrasing your request or being more specific about fields and chart types.';
                    }

                    const errorMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: friendlyMessage,
                        timestamp: new Date(),
                        resultType: 'error',
                    };
                    get().addChatMessage(errorMessage);

                    // Show error toast with retry hint
                    toast.error('AI query failed', {
                        description: 'Click "Retry" in the chat to try again.',
                    });

                    recordObservation({
                        intent: 'unknown',
                        success: false,
                        failureReason: errorMsg,
                    });
                } finally {
                    set({ aiLoading: false, aiStreamingMessageId: null, aiStreamingText: '' });
                }
            },

            retryLastQuery: async () => {
                const { lastFailedQuery } = get();
                if (!lastFailedQuery) return;

                // Remove the last error message from chat history before retrying
                const { aiChatHistory } = get();
                const lastMessage = aiChatHistory[aiChatHistory.length - 1];
                if (lastMessage?.resultType === 'error') {
                    set({ aiChatHistory: aiChatHistory.slice(0, -1) });
                }
                // Also remove the user's last message so it doesn't duplicate
                const updatedHistory = get().aiChatHistory;
                const lastUserMessage = updatedHistory[updatedHistory.length - 1];
                if (lastUserMessage?.role === 'user') {
                    set({ aiChatHistory: updatedHistory.slice(0, -1) });
                }

                // Retry the query
                await get().processAIQuery(lastFailedQuery);
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

            setMessageFeedback: (messageId: string, feedback: 'positive' | 'negative') => {
                const { aiChatHistory } = get();
                const updated = aiChatHistory.map(msg =>
                    msg.id === messageId ? { ...msg, feedback } : msg
                );
                set({ aiChatHistory: updated });

                // Persist feedback to localStorage
                try {
                    const key = 'openviz-ai-feedback';
                    const existing = JSON.parse(localStorage.getItem(key) || '[]');
                    existing.push({
                        messageId,
                        feedback,
                        timestamp: new Date().toISOString(),
                        content: aiChatHistory.find(m => m.id === messageId)?.content?.slice(0, 200),
                    });
                    localStorage.setItem(key, JSON.stringify(existing));
                } catch (e) {
                    console.warn('Failed to save AI feedback:', e);
                }
            },

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
                    crossFilters: [],
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
                    crossFilters: [],
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

            importDashboard: (dashboard: DashboardConfig, dataset: Dataset) => {
                // Save current dashboard if any
                const { dashboardConfig: currentDashboard } = get();
                if (currentDashboard) {
                    get().saveDashboard();
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
                get().saveDashboard();

                // Generate data profile in background
                try {
                    const profile = generateDataProfile(dataset.data, dataset.fields);
                    set({ dataProfile: profile });
                } catch (e) {
                    console.warn('Failed to generate data profile for imported dashboard:', e);
                }
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
                const { dashboardConfig, crossFilters } = get();
                if (!dashboardConfig) return;

                const updatedCharts = dashboardConfig.charts.filter(c => c.id !== chartId);
                const updatedItems = dashboardConfig.layout.items.filter(i => i.chartId !== chartId);

                // Clear any cross-filters from the removed chart
                const updatedCrossFilters = crossFilters.filter(f => f.sourceChartId !== chartId);

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
            // Cross-Filter Actions
            // ----------------------------------------

            setCrossFilter: (filter: CrossFilter) => {
                const { crossFilters } = get();

                // Toggle off if clicking the same value from the same chart and field
                const existing = crossFilters.find(
                    f => f.sourceChartId === filter.sourceChartId && f.field === filter.field && f.value === filter.value
                );

                if (existing) {
                    // Remove this filter (toggle off)
                    set({ crossFilters: crossFilters.filter(f => f !== existing) });
                } else {
                    // Replace any filter from the same source chart, then add new one
                    const filtered = crossFilters.filter(f => f.sourceChartId !== filter.sourceChartId);
                    set({ crossFilters: [...filtered, filter] });
                }
            },

            clearCrossFilters: () => {
                set({ crossFilters: [] });
            },

            toggleCrossFilter: () => {
                const { crossFilterEnabled } = get();
                set({ crossFilterEnabled: !crossFilterEnabled });
                if (crossFilterEnabled) {
                    // If disabling, clear active filters
                    set({ crossFilters: [] });
                }
            },

            // ----------------------------------------
            // Calculated Field Actions
            // ----------------------------------------

            addCalculatedField: (name: string, formula: string) => {
                const { dataset, calculatedFields } = get();
                if (!dataset) return;

                // Evaluate the formula to get values and result type
                import('@backend/services/formulaParser').then(({ evaluateFormula, parseFormula }) => {
                    const fieldNames = dataset.fields.map(f => f.name);
                    const { values, resultType, error } = evaluateFormula(formula, dataset.data, fieldNames);

                    if (error) {
                        toast.error('Formula error', { description: error });
                        return;
                    }

                    const { referencedFields } = parseFormula(formula, fieldNames);

                    const fieldId = uuidv4();

                    // Create the CalculatedField record
                    const calcField: CalculatedField = {
                        id: fieldId,
                        name,
                        formula,
                        resultType,
                        referencedFields,
                        createdBy: 'user',
                    };

                    // Add the computed values to dataset rows
                    const updatedData = dataset.data.map((row, i) => ({
                        ...row,
                        [name]: values[i],
                    }));

                    // Compute basic stats for the new field
                    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v as number)) as number[];
                    const stats = resultType === 'quantitative' && numericValues.length > 0
                        ? {
                            count: values.length,
                            nullCount: values.filter(v => v === null || v === undefined).length,
                            min: Math.min(...numericValues),
                            max: Math.max(...numericValues),
                            mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                            uniqueCount: new Set(numericValues).size,
                        }
                        : {
                            count: values.length,
                            nullCount: values.filter(v => v === null || v === undefined).length,
                            uniqueCount: new Set(values.map(String)).size,
                        };

                    // Create FieldInfo for the calculated field
                    const newField: FieldInfo = {
                        id: fieldId,
                        name,
                        type: resultType,
                        stats,
                        sparklineData: [],
                    };

                    // Update dataset with new field and data
                    const updatedDataset: Dataset = {
                        ...dataset,
                        fields: [...dataset.fields, newField],
                        data: updatedData,
                    };

                    set({
                        dataset: updatedDataset,
                        calculatedFields: [...calculatedFields, calcField],
                    });

                    toast.success(`Created calculated field "${name}"`);
                });
            },

            removeCalculatedField: (fieldId: string) => {
                const { dataset, calculatedFields, encodings } = get();
                if (!dataset) return;

                const calcField = calculatedFields.find(f => f.id === fieldId);
                if (!calcField) return;

                // Remove field from dataset
                const updatedFields = dataset.fields.filter(f => f.id !== fieldId);
                const updatedData = dataset.data.map(row => {
                    const newRow = { ...row };
                    delete newRow[calcField.name];
                    return newRow;
                });

                // Remove from encodings if used
                const updatedEncodings = encodings.filter(e => e.field.id !== fieldId);

                set({
                    dataset: { ...dataset, fields: updatedFields, data: updatedData },
                    calculatedFields: calculatedFields.filter(f => f.id !== fieldId),
                    encodings: updatedEncodings,
                });

                if (updatedEncodings.length !== encodings.length) {
                    get().regenerateSpec();
                }

                toast.success(`Removed calculated field "${calcField.name}"`);
            },

            // ----------------------------------------
            // Data Source Actions
            // ----------------------------------------

            setDataSource: (source: DataSourceInfo | null) => {
                set({ dataSource: source });
            },

            // ----------------------------------------
            // Refresh Actions
            // ----------------------------------------

            setRefreshInterval: (interval: RefreshInterval) => {
                const { dashboardConfig } = get();
                if (!dashboardConfig) return;

                set({
                    dashboardConfig: { ...dashboardConfig, refreshInterval: interval },
                });

                // Auto-save dashboard with new interval
                get().saveDashboard();
            },

            refreshDashboardData: async () => {
                const { dataSource, isRefreshing } = get();
                if (isRefreshing || !dataSource) return;

                set({ isRefreshing: true });

                try {
                    if (dataSource.type === 'url' && dataSource.url) {
                        const { fetchDataFromURL } = await import('@/services/urlDataService');
                        const result = await fetchDataFromURL({
                            url: dataSource.url,
                            format: 'auto',
                        });

                        // Re-infer schema and update dataset without clearing dashboard
                        const fields = inferSchema(result.data);
                        const dataset: Dataset = {
                            id: uuidv4(),
                            name: result.name,
                            fields,
                            rowCount: result.data.length,
                            data: result.data,
                            uploadedAt: new Date(),
                        };

                        set({
                            dataset,
                            dataProfile: generateDataProfile(result.data, fields),
                            lastRefreshedAt: new Date(),
                            dataSource: { ...dataSource, lastFetchedAt: new Date() },
                        });

                        toast.success('Data refreshed', {
                            description: `${result.data.length.toLocaleString()} rows updated`,
                        });
                    } else if (dataSource.type === 'google-sheets' && dataSource.spreadsheetId) {
                        const { importFromGoogleSheets } = await import('@/services/googleSheetsService');
                        const result = await importFromGoogleSheets(
                            dataSource.spreadsheetId,
                            dataSource.sheetName,
                        );

                        const fields = inferSchema(result.data);
                        const dataset: Dataset = {
                            id: uuidv4(),
                            name: `${result.spreadsheetTitle} - ${result.sheetName}`,
                            fields,
                            rowCount: result.data.length,
                            data: result.data,
                            uploadedAt: new Date(),
                        };

                        set({
                            dataset,
                            dataProfile: generateDataProfile(result.data, fields),
                            lastRefreshedAt: new Date(),
                            dataSource: { ...dataSource, lastFetchedAt: new Date() },
                        });

                        toast.success('Google Sheets data refreshed', {
                            description: `${result.data.length.toLocaleString()} rows updated`,
                        });
                    } else {
                        toast.info('Manual refresh not available', {
                            description: 'Auto-refresh only works with URL and Google Sheets data sources',
                        });
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Refresh failed';
                    console.error('Dashboard refresh failed:', error);
                    toast.error('Refresh failed', { description: msg });
                } finally {
                    set({ isRefreshing: false });
                }
            },

            // ----------------------------------------
            // Drill-Down Actions
            // ----------------------------------------

            drillDown: (field: string, value: string | number, level: TemporalDrillLevel | string) => {
                const { drillPath, drillHierarchies } = get();
                const hierarchy = drillHierarchies.find(h => h.sourceField === field);
                if (!hierarchy) return;

                // Check we can drill deeper
                const lastLevel = drillPath.length > 0 ? drillPath[drillPath.length - 1].level : null;
                const currentIdx = lastLevel ? hierarchy.availableLevels.indexOf(lastLevel) : -1;
                const nextIdx = currentIdx + 1;
                if (nextIdx >= hierarchy.availableLevels.length - 1) return; // already at deepest display level

                const newStep: DrillLevel = {
                    field,
                    value,
                    level: level as TemporalDrillLevel,
                    label: String(value),
                };

                set({
                    drillPath: [...drillPath, newStep],
                    drillActiveField: field,
                });
                get().regenerateSpec();
            },

            drillUp: () => {
                const { drillPath } = get();
                if (drillPath.length === 0) return;

                const newPath = drillPath.slice(0, -1);
                set({
                    drillPath: newPath,
                    drillActiveField: newPath.length > 0 ? newPath[0].field : null,
                });
                get().regenerateSpec();
            },

            drillReset: () => {
                set({
                    drillPath: [],
                    drillActiveField: null,
                });
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
                const { dataset, chartConfig, encodings, showAnnotations, filteredData, forecastData, comparisonResult, drillPath, drillHierarchies, drillActiveField } = get();

                if (!dataset || encodings.length === 0) {
                    set({ echartsOption: null });
                    return;
                }

                // Use filtered data if active, otherwise full dataset
                let dataToUse = filteredData ?? dataset.data;
                let effectiveEncodings = encodings;

                // Apply drill-down data transformation
                if (drillPath.length > 0 && drillActiveField) {
                    const hierarchy = drillHierarchies.find(h => h.sourceField === drillActiveField);
                    if (hierarchy && hierarchy.type === 'temporal') {
                        const currentLevel = getCurrentDrillLevel(drillPath, hierarchy.availableLevels);
                        const drillResult = getDrillData(dataToUse, drillActiveField, drillPath, currentLevel);
                        dataToUse = drillResult.data;

                        // Replace the temporal x-axis encoding with the drill field
                        const xEncoding = encodings.find(e => e.channel === 'x' && e.field.name === drillActiveField);
                        if (xEncoding) {
                            effectiveEncodings = encodings.map(e => {
                                if (e.channel === 'x' && e.field.name === drillActiveField) {
                                    return {
                                        ...e,
                                        field: {
                                            ...e.field,
                                            name: drillResult.drillField,
                                            type: 'nominal' as const, // Drill categories are nominal
                                        },
                                        timeUnit: undefined, // Don't apply time unit to drill field
                                    };
                                }
                                return e;
                            });
                        }
                    }
                }

                const configWithEncodings: ChartConfig = {
                    ...chartConfig,
                    encodings: effectiveEncodings,
                    // Remove annotations if toggle is off
                    annotations: showAnnotations ? chartConfig.annotations : undefined,
                };

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
export const selectAIStreamingMessageId = (state: VizState) => state.aiStreamingMessageId;
export const selectAIStreamingText = (state: VizState) => state.aiStreamingText;
export const selectAIInsights = (state: VizState) => state.aiInsights;
export const selectAIQueryObservability = (state: VizState) => state.aiQueryObservability;

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

// Cross-Filter Selectors
export const selectCrossFilters = (state: VizState) => state.crossFilters;
export const selectCrossFilterEnabled = (state: VizState) => state.crossFilterEnabled;

// Calculated Field Selectors
export const selectCalculatedFields = (state: VizState) => state.calculatedFields;

// Data Source Selectors
export const selectDataSource = (state: VizState) => state.dataSource;
export const selectIsRefreshing = (state: VizState) => state.isRefreshing;
export const selectLastRefreshedAt = (state: VizState) => state.lastRefreshedAt;

// Drill-Down Selectors
export const selectDrillPath = (state: VizState) => state.drillPath;
export const selectDrillHierarchies = (state: VizState) => state.drillHierarchies;
export const selectDrillActiveField = (state: VizState) => state.drillActiveField;

// UI Selectors
export const selectLeftSidebarOpen = (state: VizState) => state.leftSidebarOpen;
export const selectRightSidebarOpen = (state: VizState) => state.rightSidebarOpen;
export const selectFieldById = (id: string) => (state: VizState) =>
    state.dataset?.fields.find(f => f.id === id);

