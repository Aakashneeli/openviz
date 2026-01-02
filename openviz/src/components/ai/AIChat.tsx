// ============================================
// AIChat - Enhanced Chat Panel with Q&A Support
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, MessageSquare, Minimize2, AlertCircle, BarChart3, LayoutDashboard, MessageCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVizStore, selectDataset, selectAILoading, selectAIChatHistory } from '@/store/useVizStore';
import { isAIAvailable } from '@/services/groqService';
import { cn } from '@/lib/utils';

export function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Use store's chat history instead of local state
    const dataset = useVizStore(selectDataset);
    const aiLoading = useVizStore(selectAILoading);
    const chatHistory = useVizStore(selectAIChatHistory);
    const { processAIQuery } = useVizStore();

    const aiAvailable = isAIAvailable();
    const hasData = !!dataset;
    const canSubmit = aiAvailable && hasData && !aiLoading;

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !canSubmit) return;

        const currentQuery = query;
        setQuery('');

        // The store handles adding messages to history
        await processAIQuery(currentQuery);
    };

    // Enhanced suggestions including questions
    const suggestions = [
        { text: 'What is the average sales?', type: 'question' },
        { text: 'Show a bar chart of sales by region', type: 'chart' },
        { text: 'Create a sales overview dashboard', type: 'dashboard' },
        { text: 'Summarize this data', type: 'question' },
    ];

    // Get icon for message type
    const getMessageIcon = (resultType?: string) => {
        switch (resultType) {
            case 'chart':
                return <BarChart3 className="w-3 h-3 mr-1" />;
            case 'dashboard':
                return <LayoutDashboard className="w-3 h-3 mr-1" />;
            case 'text':
                return <MessageCircle className="w-3 h-3 mr-1" />;
            default:
                return null;
        }
    };

    // Floating button - Bottom Right
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
                className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white font-semibold shadow-[0_8px_32px_rgba(124,58,237,0.4)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20"
            >
                <Sparkles className="w-5 h-5" />
                <span>AI Assistant</span>
            </button>
        );
    }

    // Chat panel - Bottom Right, Solid Background
    return (
        <div
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
            className="w-[420px] h-[550px] bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/20">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="block text-sm font-semibold text-foreground leading-none mb-0.5">AI Assistant</span>
                        <span className="text-[10px] text-muted-foreground">Ask questions or create charts</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/5"
                >
                    <Minimize2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Status warnings */}
            {!aiAvailable && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-500">
                    <AlertCircle className="w-3 h-3" />
                    API key not configured
                </div>
            )}
            {aiAvailable && !hasData && (
                <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2 text-xs text-blue-400">
                    <AlertCircle className="w-3 h-3" />
                    Upload data to use AI
                </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-3">
                            <MessageSquare className="w-6 h-6 text-violet-400" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Ask questions or create charts</p>
                        <p className="text-xs text-muted-foreground mb-6">I can answer data questions with 100% accuracy</p>
                        <div className="w-full flex flex-col gap-1.5">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setQuery(s.text)}
                                    disabled={!canSubmit}
                                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-white/5 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 hover:border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                                >
                                    {s.type === 'question' && <HelpCircle className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />}
                                    {s.type === 'chart' && <BarChart3 className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-300" />}
                                    {s.type === 'dashboard' && <LayoutDashboard className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />}
                                    <span>{s.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {chatHistory.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground"
                                            : msg.resultType === 'error'
                                                ? "bg-destructive/10 text-destructive-foreground border border-destructive/20"
                                                : "bg-muted/50 text-foreground border border-border/50",
                                        msg.resultType === 'text' && "border-blue-500/30 bg-blue-500/5"
                                    )}
                                >
                                    {msg.role === 'assistant' && msg.resultType && (
                                        <div className={cn(
                                            "flex items-center mb-1 text-[10px] uppercase font-bold tracking-wider",
                                            msg.resultType === 'text' ? "text-blue-400" :
                                                msg.resultType === 'chart' ? "text-emerald-400" :
                                                    msg.resultType === 'dashboard' ? "text-amber-400" : "text-muted-foreground"
                                        )}>
                                            {getMessageIcon(msg.resultType)}
                                            {msg.resultType === 'text' ? 'Answer' :
                                                msg.resultType === 'chart' ? 'Chart Created' :
                                                    msg.resultType === 'dashboard' ? 'Dashboard' : 'Response'}
                                        </div>
                                    )}
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {aiLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted/50 px-3.5 py-2.5 rounded-2xl flex items-center gap-2 border border-border/50">
                                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                                    <span className="text-xs text-muted-foreground">Analyzing...</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 bg-muted/20">
                <div className="flex gap-2">
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={canSubmit ? "Ask a question or describe a chart..." : "Load data first..."}
                        disabled={!canSubmit}
                        className="flex-1 h-10 bg-background/50 border-input focus:border-primary/50 text-sm shadow-inner"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!query.trim() || !canSubmit}
                        className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                        {aiLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
