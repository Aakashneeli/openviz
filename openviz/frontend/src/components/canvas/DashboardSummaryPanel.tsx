// ============================================
// DashboardSummaryPanel - AI Summary for Dashboards
// ============================================

import { Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp, Check, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@backend/types';

interface DashboardSummaryPanelProps {
    summary: DashboardSummary | null;
    isLoading: boolean;
    onGenerate: () => void;
}

export function DashboardSummaryPanel({ summary, isLoading, onGenerate }: DashboardSummaryPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!summary) return;
        const text = `Dashboard Overview:\n${summary.overview}\n\nKey Takeaways:\n${summary.keyTakeaways.map(t => `• ${t}`).join('\n')}`;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // No summary yet - show generate button
    if (!summary && !isLoading) {
        return (
            <div className="mb-4 p-4 rounded-lg border border-dashed border-border bg-card/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">AI Dashboard Summary</p>
                        <p className="text-xs text-muted-foreground">Get insights about your entire dashboard</p>
                    </div>
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={onGenerate}
                    className="gap-2"
                >
                    <Sparkles className="h-4 w-4" />
                    Summarize All
                </Button>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="mb-4 rounded-lg border border-border bg-card/50 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-5 rounded bg-primary/20" />
                    <div className="h-4 w-32 rounded bg-muted" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-4/5 rounded bg-muted" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="h-16 rounded bg-muted" />
                    <div className="h-16 rounded bg-muted" />
                    <div className="h-16 rounded bg-muted" />
                </div>
            </div>
        );
    }

    // Summary display
    return (
        <div className="mb-4 rounded-lg border border-border bg-card/50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 to-purple-500/10 cursor-pointer hover:from-primary/15 hover:to-purple-500/15 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <span className="text-sm font-medium text-foreground">Dashboard Summary</span>
                        <p className="text-xs text-muted-foreground">
                            {summary?.chartSummaries.length} charts analyzed
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                        }}
                    >
                        {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            onGenerate();
                        }}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
                    </Button>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && summary && (
                <div className="px-4 py-4 space-y-4">
                    {/* Overview */}
                    <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Overview
                        </span>
                        <p className="mt-1 text-sm text-foreground/90 leading-relaxed">
                            {summary.overview}
                        </p>
                    </div>

                    {/* Key Takeaways */}
                    {summary.keyTakeaways.length > 0 && (
                        <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Key Takeaways
                            </span>
                            <ul className="mt-2 space-y-1.5">
                                {summary.keyTakeaways.map((takeaway, index) => (
                                    <li
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-foreground/80 bg-muted/30 rounded-md px-3 py-2"
                                    >
                                        <span className="text-primary font-bold">{index + 1}.</span>
                                        <span>{takeaway}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-[10px] text-muted-foreground/60 pt-2 border-t border-border/50">
                        Generated {summary.generatedAt.toLocaleTimeString()}
                    </div>
                </div>
            )}
        </div>
    );
}
