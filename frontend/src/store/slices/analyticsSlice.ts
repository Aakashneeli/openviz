import type {
    DataRecord,
    FilterSpec,
    ReportData,
    ComparisonSpec,
    ComparisonResult,
    ForecastResult,
} from '@backend/types';
import type { StoreSet, StoreGet } from './types';

// ============================================
// Analytics Slice
// ============================================

export const createAnalyticsSlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    activeFilters: null as FilterSpec | null,
    filteredData: null as DataRecord[] | null,
    reportData: null as ReportData | null,
    reportLoading: false,
    showReportModal: false,
    comparisonMode: false,
    comparisonSpec: null as ComparisonSpec | null,
    comparisonResult: null as ComparisonResult | null,
    forecastData: null as ForecastResult | null,
    forecastLoading: false,

    // Actions

    applyFilter: (spec: FilterSpec) => {
        const state = get() as any;
        const { dataset } = state;
        if (!dataset) return;

        import('@backend/services/filterService').then(({ applyFilters }) => {
            const filtered = applyFilters(dataset.data, spec);
            set({ activeFilters: spec, filteredData: filtered });
            (get() as any).regenerateSpec();
        });
    },

    clearFilters: () => {
        set({ activeFilters: null, filteredData: null });
        (get() as any).regenerateSpec();
    },

    generateReport: async () => {
        const state = get() as any;
        const { dataset, dataProfile, chartConfig, encodings, dashboardConfig, viewMode } = state;
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
        const state = get() as any;
        const { reportData } = state;
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

    setShowReportModal: (show: boolean) => set({ showReportModal: show }),

    applyComparison: (spec: ComparisonSpec) => {
        const state = get() as any;
        const { dataset } = state;
        if (!dataset) return;

        import('@backend/services/comparisonService').then(({ executeComparison }) => {
            const result = executeComparison(dataset.data, spec);
            set({ comparisonMode: true, comparisonSpec: spec, comparisonResult: result });
            (get() as any).regenerateSpec();
        });
    },

    clearComparison: () => {
        set({ comparisonMode: false, comparisonSpec: null, comparisonResult: null });
        (get() as any).regenerateSpec();
    },

    generateForecast: async (periods = 6) => {
        const state = get() as any;
        const { dataset, encodings } = state;
        if (!dataset) return;

        const xEnc = encodings.find((e: any) => e.channel === 'x');
        const yEnc = encodings.find((e: any) => e.channel === 'y');
        if (!xEnc || !yEnc) return;

        set({ forecastLoading: true });

        try {
            const { generateForecast } = await import('@backend/services/forecastService');
            const result = generateForecast(dataset.data, xEnc.field.name, yEnc.field.name, periods);
            set({ forecastData: result, forecastLoading: false });
            (get() as any).regenerateSpec();
        } catch (error) {
            console.error('Forecast Error:', error);
            set({ forecastLoading: false });
        }
    },

    clearForecast: () => {
        set({ forecastData: null });
        (get() as any).regenerateSpec();
    },
});
