// ============================================
// AIQueryBar - Prominent AI Assistant
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVizStore, selectDataset, selectAILoading } from '@/store/useVizStore';
import { isAIAvailable } from '@backend/services/groqService';
import { cn } from '@/lib/utils';

export function AIQueryBar() {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const dataset = useVizStore(selectDataset);
    const aiLoading = useVizStore(selectAILoading);
    const { processAIQuery } = useVizStore();

    const aiAvailable = isAIAvailable();
    const canUse = aiAvailable && dataset;

    useEffect(() => {
        if (expanded && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [expanded]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || aiLoading || !canUse) return;

        await processAIQuery(query);
        setQuery('');
        setExpanded(false);
    };

    const suggestions = [
        'Show a bar chart',
        'Compare by category',
        'Trend over time',
    ];

    // Collapsed state - just icon button
    if (!expanded) {
        return (
            <Button
                onClick={() => setExpanded(true)}
                disabled={!canUse}
                className={cn(
                    "relative overflow-hidden",
                    canUse
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-violet-500/25"
                        : "bg-gray-800 text-gray-500"
                )}
                size="sm"
            >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Assist
                {canUse && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
            </Button>
        );
    }

    // Expanded state - search bar
    return (
        <div className="flex items-center gap-2 animate-in slide-in-from-right-5 duration-200">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Describe your chart..."
                        disabled={aiLoading}
                        className="w-64 pl-9 pr-20 h-9 bg-[#1a1a1e] border-violet-500/30 focus:border-violet-500 text-sm"
                    />
                    {/* Quick suggestions */}
                    {!query && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            {suggestions.slice(0, 1).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setQuery(s)}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <Button
                    type="submit"
                    size="sm"
                    disabled={!query.trim() || aiLoading}
                    className="bg-violet-600 hover:bg-violet-500 h-9"
                >
                    {aiLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </form>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(false)}
                className="h-9 w-9 text-gray-400 hover:text-white"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
