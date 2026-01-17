// ============================================
// AIChat - Enhanced Chat Panel with Q&A Support
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, MessageSquare, Minimize2, AlertCircle, BarChart3, LayoutDashboard, MessageCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVizStore, selectDataset, selectAILoading, selectAIChatHistory } from '@/store/useVizStore';
import { isAIAvailable } from '@backend/services/groqService';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function AIChat() {
    // Use store state for visibility
    const isOpen = useVizStore(state => state.aiChatOpen);
    const { setAIChatOpen } = useVizStore();
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

    return (
        <AnimatePresence mode="wait">
            {!isOpen ? (
                <motion.button
                    key="ai-button"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    onClick={() => setAIChatOpen(true)}
                    title="Ask AI"
                    className="group relative flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border border-white/20 hover:scale-105 active:scale-95 transition-transform"
                >
                    <Sparkles className="w-4.5 h-4.5" />
                </motion.button>
            ) : (
                <motion.div
                    key="ai-panel"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-[380px] h-[500px] bg-[#0A0A0B]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden ring-1 ring-white/5"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <span className="block text-sm font-semibold text-slate-200 leading-none mb-0.5">OpenViz AI</span>
                                <span className="text-[10px] text-indigo-400">Powered by LLaMA 3</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAIChatOpen(false)}
                            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
                        >
                            <Minimize2 className="h-3.5 w-3.5" />
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
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-3 ring-1 ring-white/5">
                                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-200 mb-1">How can I help you visualize?</p>
                                <p className="text-xs text-slate-500 mb-6 max-w-[200px]">I can generate charts, explain data, and build dashboards.</p>
                                <div className="w-full flex flex-col gap-1.5">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setQuery(s.text)}
                                            disabled={!canSubmit}
                                            className="w-full text-left text-[11px] px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                                        >
                                            {s.type === 'question' && <HelpCircle className="w-3 h-3 text-indigo-400 group-hover:text-indigo-300" />}
                                            {s.type === 'chart' && <BarChart3 className="w-3 h-3 text-emerald-400 group-hover:text-emerald-300" />}
                                            {s.type === 'dashboard' && <LayoutDashboard className="w-3 h-3 text-amber-400 group-hover:text-amber-300" />}
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
                                            "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
                                            msg.role === 'user' ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                                                msg.role === 'user'
                                                    ? "bg-indigo-600 text-white rounded-tr-sm"
                                                    : msg.resultType === 'error'
                                                        ? "bg-red-500/10 text-red-200 border border-red-500/20 rounded-tl-sm"
                                                        : "bg-white/5 text-slate-200 border border-white/10 rounded-tl-sm",
                                                msg.resultType === 'text' && "border-indigo-500/30 bg-indigo-500/5"
                                            )}
                                        >
                                            {msg.role === 'assistant' && msg.resultType && (
                                                <div className={cn(
                                                    "flex items-center mb-1 text-[10px] uppercase font-bold tracking-wider",
                                                    msg.resultType === 'text' ? "text-indigo-400" :
                                                        msg.resultType === 'chart' ? "text-emerald-400" :
                                                            msg.resultType === 'dashboard' ? "text-amber-400" : "text-slate-400"
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
                                        <div className="bg-white/5 px-3.5 py-2 rounded-2xl flex items-center gap-2 border border-white/5">
                                            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                            <span className="text-xs text-slate-400">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-white/5 bg-black/20">
                        <div className="flex gap-2 relative">
                            <Input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={canSubmit ? "Ask OpenViz..." : "Load data first..."}
                                disabled={!canSubmit}
                                className="flex-1 h-10 pl-4 pr-12 bg-white/5 border-white/10 focus:border-indigo-500/50 focus:bg-white/10 text-sm text-slate-200 placeholder:text-slate-600 rounded-xl transition-all"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!query.trim() || !canSubmit}
                                className="absolute right-1 top-1 h-8 w-8 bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 rounded-lg transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                {aiLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Send className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
