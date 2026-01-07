import { useState } from 'react';
import { Search, Share2, User, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore } from '@/store/useVizStore';

export function CommandBar() {
    const [query, setQuery] = useState('');
    const { processAIQuery, setAIChatOpen } = useVizStore();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            setAIChatOpen(true);
            processAIQuery(query);
            setQuery('');
        }
    };

    return (
        <div className="h-12 flex items-center justify-between px-4 select-none">
            {/* Left: Brand */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Command className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                    OpenViz
                </span>
            </div>

            {/* Center: Omni-Search */}
            <div className="flex-1 max-w-xl mx-4">
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative w-full h-9 flex items-center gap-3 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group-hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        <Search className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask AI..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-muted-foreground group-hover:text-slate-100 transition-colors"
                        />
                        <div className="ml-auto flex items-center gap-1">
                            <kbd className="h-5 px-1.5 rounded bg-black/20 border border-white/10 text-[10px] font-mono text-muted-foreground flex items-center">
                                ⌘K
                            </kbd>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg"
                >
                    <Share2 className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10 flex items-center justify-center shadow-inner">
                    <User className="w-4 h-4 text-slate-400" />
                </div>
            </div>
        </div>
    );
}
