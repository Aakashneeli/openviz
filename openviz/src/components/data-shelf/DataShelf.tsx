import { useMemo, useState, useRef } from 'react';
import { Search, Database, Upload, FileUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DraggableField } from './DraggableField';
import { useVizStore, selectFields, selectDataset } from '@/store/useVizStore';

export function DataShelf() {
    const [searchQuery, setSearchQuery] = useState('');
    const dataset = useVizStore(selectDataset);
    const fields = useVizStore(selectFields);
    const loadDataFromFile = useVizStore(state => state.loadDataFromFile);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            loadDataFromFile(file);
        }
        // Reset input so validation logic or re-upload works
        if (event.target) event.target.value = '';
    };

    const triggerUpload = () => fileInputRef.current?.click();

    const filteredFields = useMemo(() => {
        return fields.filter(f =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [fields, searchQuery]);

    if (!dataset) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-card/10">
                <div className="w-16 h-16 mb-4 rounded-full bg-primary/5 flex items-center justify-center animate-pulse-slow">
                    <Database className="w-8 h-8 text-primary/40" />
                </div>
                <h3 className="text-lg font-medium text-foreground/80 mb-2">No Dataset</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] mb-6">
                    Upload a CSV/JSON file to activate the studio.
                </p>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv,.tsv,.json"
                    className="hidden"
                />

                <Button
                    onClick={triggerUpload}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Data
                </Button>
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
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3">
                    {/* Data Source Label */}
                    <div className="px-1 py-1 mb-2 text-[10px] uppercase font-bold text-muted-foreground/40 tracking-wider flex items-center gap-1.5 opacity-0 animate-fade-in fill-mode-forwards" style={{ animationDelay: '100ms' }}>
                        <Database className="w-3 h-3 text-indigo-400" />
                        <span className="truncate max-w-[150px]">{dataset.name}</span>
                        <div className="ml-auto w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {filteredFields.length > 0 ? (
                            filteredFields.map(field => (
                                <DraggableField key={field.id} field={field} />
                            ))
                        ) : (
                            <div className="w-full py-8 text-muted-foreground/30 text-xs italic text-center border border-dashed border-white/5 rounded-lg">
                                No matching fields
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
