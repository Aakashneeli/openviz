import { useMemo, useState, useRef } from 'react';
import { Search, Database, Upload, FileUp, ChevronDown, BarChart3, TrendingUp, MousePointer, Loader2, FolderOpen, FunctionSquare, X, Globe, FileSpreadsheet } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { DraggableField } from './DraggableField';
import { CalculatedFieldDialog } from './CalculatedFieldDialog';
import { URLImportDialog } from './URLImportDialog';
import { GoogleSheetsConnector } from './GoogleSheetsConnector';
import { useVizStore, selectFields, selectDataset, selectCalculatedFields } from '@/store/useVizStore';
import { sampleDatasets, loadSampleDataset } from '@/data/sampleDatasets';
import { importDashboardFromJSON } from '@/services/exportService';
import { toast } from '@/lib/toast';
import Papa from 'papaparse';

export function DataShelf() {
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingSample, setLoadingSample] = useState<string | null>(null);
    const [showCalcFieldDialog, setShowCalcFieldDialog] = useState(false);
    const [showURLImport, setShowURLImport] = useState(false);
    const [showGoogleSheets, setShowGoogleSheets] = useState(false);
    const dataset = useVizStore(selectDataset);
    const fields = useVizStore(selectFields);
    const calculatedFields = useVizStore(selectCalculatedFields);
    const loadDataFromFile = useVizStore(state => state.loadDataFromFile);
    const importDashboard = useVizStore(state => state.importDashboard);
    const removeCalculatedField = useVizStore(state => state.removeCalculatedField);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dashboardImportRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            loadDataFromFile(file);
        }
        // Reset input so validation logic or re-upload works
        if (event.target) event.target.value = '';
    };

    const triggerUpload = () => fileInputRef.current?.click();

    const handleDashboardImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const { dashboard, dataset: importedDataset } = await importDashboardFromJSON(file);
            importDashboard(dashboard, importedDataset);
            toast.success('Dashboard imported successfully', {
                description: `${dashboard.charts.length} charts loaded`,
            });
        } catch (error) {
            console.error('Dashboard import failed:', error);
            toast.error('Failed to import dashboard', {
                description: error instanceof Error ? error.message : 'Invalid dashboard file',
            });
        }
        if (event.target) event.target.value = '';
    };

    const handleLoadSample = async (sampleId: string) => {
        const sample = sampleDatasets.find(s => s.id === sampleId);
        if (!sample) return;

        setLoadingSample(sampleId);
        try {
            // Fetch the CSV text from the public folder
            const csvText = await loadSampleDataset(sample.filename);

            // Parse CSV to get data
            const parseResult = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
            });

            if (parseResult.errors.length > 0) {
                console.error('CSV parse errors:', parseResult.errors);
            }

            // Create a File object from the CSV text to reuse existing logic
            const blob = new Blob([csvText], { type: 'text/csv' });
            const file = new File([blob], sample.filename, { type: 'text/csv' });

            await loadDataFromFile(file);
        } catch (error) {
            console.error('Failed to load sample dataset:', error);
        } finally {
            setLoadingSample(null);
        }
    };

    const getSampleIcon = (iconType: string) => {
        switch (iconType) {
            case 'chart-bar':
                return <BarChart3 className="w-4 h-4 text-indigo-400" />;
            case 'trending-up':
                return <TrendingUp className="w-4 h-4 text-emerald-400" />;
            case 'mouse-pointer':
                return <MousePointer className="w-4 h-4 text-amber-400" />;
            default:
                return <Database className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const filteredFields = useMemo(() => {
        return fields.filter(f =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [fields, searchQuery]);

    if (!dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-card/10">
                <div className="w-16 h-16 mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Database className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Get Started</h3>
                <p className="text-xs text-muted-foreground max-w-[220px] mb-4">
                    Drop a file here or click to upload your data and start creating visualizations.
                </p>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv,.tsv,.json,.xlsx,.xls"
                    className="hidden"
                />

                <Button
                    onClick={triggerUpload}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 mb-3"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Data
                </Button>

                {/* Sample Data Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 mb-4"
                            disabled={loadingSample !== null}
                        >
                            {loadingSample ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Database className="w-4 h-4 mr-2" />
                                    Try Sample Data
                                    <ChevronDown className="w-3 h-3 ml-2" />
                                </>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-64">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Sample Datasets
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {sampleDatasets.map((sample) => (
                            <DropdownMenuItem
                                key={sample.id}
                                onClick={() => handleLoadSample(sample.id)}
                                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                            >
                                <div className="flex items-center gap-2 w-full">
                                    {getSampleIcon(sample.icon)}
                                    <span className="font-medium text-sm">{sample.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground pl-6 leading-tight">
                                    {sample.description}
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Import from URL */}
                <Button
                    variant="outline"
                    onClick={() => setShowURLImport(true)}
                    className="border-dashed border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 mb-3"
                >
                    <Globe className="w-4 h-4 mr-2" />
                    Import from URL
                </Button>

                {/* Google Sheets Connector */}
                <Button
                    variant="outline"
                    onClick={() => setShowGoogleSheets(true)}
                    className="border-dashed border-green-500/30 text-green-400 hover:text-green-300 hover:border-green-500/50 hover:bg-green-500/10 mb-3"
                >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Google Sheets
                </Button>

                <input
                    type="file"
                    ref={dashboardImportRef}
                    onChange={handleDashboardImport}
                    accept=".json"
                    className="hidden"
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dashboardImportRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-foreground mb-4"
                >
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                    Import Dashboard
                </Button>

                <div className="text-[10px] text-muted-foreground/60 space-y-1">
                    <p>Supported formats:</p>
                    <p className="font-mono text-muted-foreground/40">CSV, TSV, JSON, Excel, URL, Google Sheets</p>
                </div>

                {/* URL Import Dialog */}
                <URLImportDialog
                    open={showURLImport}
                    onClose={() => setShowURLImport(false)}
                />

                {/* Google Sheets Connector */}
                <GoogleSheetsConnector
                    open={showGoogleSheets}
                    onClose={() => setShowGoogleSheets(false)}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Search - High Density */}
            <div className="p-2 border-b border-border flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 pl-8 bg-muted/30 border-transparent text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 focus:bg-background transition-all rounded-sm placeholder:text-muted-foreground/50"
                        placeholder="Search fields..."
                    />
                </div>

                {/* Minimal Upload Action for switching datasets */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv,.tsv,.json"
                    className="hidden"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={triggerUpload}
                    className="h-7 w-7 text-muted-foreground hover:text-white"
                    title="Upload new dataset"
                >
                    <FileUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowURLImport(true)}
                    className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
                    title="Import from URL"
                >
                    <Globe className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowGoogleSheets(true)}
                    className="h-7 w-7 text-muted-foreground hover:text-green-400"
                    title="Google Sheets"
                >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3">
                    {/* Data Source Label */}
                    <div className="px-1 py-1 mb-2 text-[10px] uppercase font-bold text-muted-foreground/40 tracking-wider flex items-center gap-1.5 opacity-0 animate-fade-in fill-mode-forwards" style={{ animationDelay: '100ms' }}>
                        <Database className="w-3 h-3 text-indigo-400" />
                        <span className="truncate max-w-[150px]">{dataset.name}</span>
                        <div className="ml-auto w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    </div>

                    {/* Regular Fields */}
                    <div className="flex flex-wrap gap-2">
                        {filteredFields.length > 0 ? (
                            filteredFields.map(field => {
                                const isCalculated = calculatedFields.some(cf => cf.id === field.id);
                                return (
                                    <div key={field.id} className="relative group/calc">
                                        <DraggableField field={field} />
                                        {isCalculated && (
                                            <>
                                                <span className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-violet-500 rounded-full flex items-center justify-center border border-slate-900" title="Calculated field">
                                                    <FunctionSquare className="w-2 h-2 text-white" />
                                                </span>
                                                <button
                                                    onClick={() => removeCalculatedField(field.id)}
                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full items-center justify-center border border-slate-900 hidden group-hover/calc:flex"
                                                    title="Remove calculated field"
                                                >
                                                    <X className="w-2 h-2 text-white" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="w-full py-8 text-muted-foreground/30 text-xs italic text-center border border-dashed border-white/5 rounded-lg">
                                No matching fields
                            </div>
                        )}
                    </div>

                    {/* New Calculated Field Button */}
                    <button
                        onClick={() => setShowCalcFieldDialog(true)}
                        className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 transition-colors text-xs"
                    >
                        <FunctionSquare className="w-3.5 h-3.5" />
                        New Calculated Field
                    </button>
                </div>
            </ScrollArea>

            {/* Calculated Field Dialog */}
            <CalculatedFieldDialog
                open={showCalcFieldDialog}
                onClose={() => setShowCalcFieldDialog(false)}
            />

            {/* URL Import Dialog */}
            <URLImportDialog
                open={showURLImport}
                onClose={() => setShowURLImport(false)}
            />

            {/* Google Sheets Connector */}
            <GoogleSheetsConnector
                open={showGoogleSheets}
                onClose={() => setShowGoogleSheets(false)}
            />
        </div>
    );
}
