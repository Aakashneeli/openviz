import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
    Dataset,
    FieldInfo,
    DataRecord,
    UploadStatus,
    DataProfile,
    CalculatedField,
    DataSourceInfo,
    RefreshInterval,
    DrillLevel,
    DrillHierarchy,
    TemporalDrillLevel,
} from '@backend/types';
import { inferSchema } from '@backend/utils/schemaInference';
import { detectHierarchies } from '@backend/services/drillService';
import { getChartSuggestions } from '@backend/utils/autoChart';
import { generateDataProfile } from '@backend/services/dataContextService';
import { toast } from '@/lib/toast';
import type { StoreSet, StoreGet } from './types';
import { initialChartConfig } from './chartSlice';

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
// localStorage Persistence Helper (for clearing dashboards on new data)
// ============================================

const DASHBOARDS_STORAGE_KEY = 'openviz-dashboards';

function saveDashboardsToStorage(dashboards: unknown[]): void {
    try {
        localStorage.setItem(DASHBOARDS_STORAGE_KEY, JSON.stringify(dashboards));
    } catch (e) {
        console.error('Failed to save dashboards to localStorage:', e);
    }
}

// ============================================
// Data Slice
// ============================================

export const createDataSlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    dataset: null as Dataset | null,
    uploadStatus: { state: 'idle', progress: 0 } as UploadStatus,
    dataProfile: null as DataProfile | null,
    dataSource: null as DataSourceInfo | null,
    isRefreshing: false,
    lastRefreshedAt: null as Date | null,
    calculatedFields: [] as CalculatedField[],
    drillPath: [] as DrillLevel[],
    drillHierarchies: [] as DrillHierarchy[],
    drillActiveField: null as string | null,

    // Actions

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
            (get() as any).generateRecommendations();

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

    addCalculatedField: (name: string, formula: string) => {
        const state = get() as any;
        const { dataset, calculatedFields } = state;
        if (!dataset) return;

        // Evaluate the formula to get values and result type
        import('@backend/services/formulaParser').then(({ evaluateFormula, parseFormula }) => {
            const fieldNames = dataset.fields.map((f: FieldInfo) => f.name);
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
            const updatedData = dataset.data.map((row: DataRecord, i: number) => ({
                ...row,
                [name]: values[i],
            }));

            // Compute basic stats for the new field
            const numericValues = values.filter((v: unknown) => typeof v === 'number' && !isNaN(v as number)) as number[];
            const stats = resultType === 'quantitative' && numericValues.length > 0
                ? {
                    count: values.length,
                    nullCount: values.filter((v: unknown) => v === null || v === undefined).length,
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    mean: numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length,
                    uniqueCount: new Set(numericValues).size,
                }
                : {
                    count: values.length,
                    nullCount: values.filter((v: unknown) => v === null || v === undefined).length,
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
        const state = get() as any;
        const { dataset, calculatedFields, encodings } = state;
        if (!dataset) return;

        const calcField = calculatedFields.find((f: CalculatedField) => f.id === fieldId);
        if (!calcField) return;

        // Remove field from dataset
        const updatedFields = dataset.fields.filter((f: FieldInfo) => f.id !== fieldId);
        const updatedData = dataset.data.map((row: DataRecord) => {
            const newRow = { ...row };
            delete newRow[calcField.name];
            return newRow;
        });

        // Remove from encodings if used
        const updatedEncodings = encodings.filter((e: any) => e.field.id !== fieldId);

        set({
            dataset: { ...dataset, fields: updatedFields, data: updatedData },
            calculatedFields: calculatedFields.filter((f: CalculatedField) => f.id !== fieldId),
            encodings: updatedEncodings,
        });

        if (updatedEncodings.length !== encodings.length) {
            (get() as any).regenerateSpec();
        }

        toast.success(`Removed calculated field "${calcField.name}"`);
    },

    setDataSource: (source: DataSourceInfo | null) => {
        set({ dataSource: source });
    },

    setRefreshInterval: (interval: RefreshInterval) => {
        const state = get() as any;
        const { dashboardConfig } = state;
        if (!dashboardConfig) return;

        set({
            dashboardConfig: { ...dashboardConfig, refreshInterval: interval },
        });

        // Auto-save dashboard with new interval
        (get() as any).saveDashboard();
    },

    refreshDashboardData: async () => {
        const state = get() as any;
        const { dataSource, isRefreshing } = state;
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

    drillDown: (field: string, value: string | number, level: TemporalDrillLevel | string) => {
        const state = get() as any;
        const { drillPath, drillHierarchies } = state;
        const hierarchy = drillHierarchies.find((h: DrillHierarchy) => h.sourceField === field);
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
        (get() as any).regenerateSpec();
    },

    drillUp: () => {
        const state = get() as any;
        const { drillPath } = state;
        if (drillPath.length === 0) return;

        const newPath = drillPath.slice(0, -1);
        set({
            drillPath: newPath,
            drillActiveField: newPath.length > 0 ? newPath[0].field : null,
        });
        (get() as any).regenerateSpec();
    },

    drillReset: () => {
        set({
            drillPath: [],
            drillActiveField: null,
        });
        (get() as any).regenerateSpec();
    },
});
