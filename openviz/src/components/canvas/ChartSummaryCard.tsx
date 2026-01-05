// ============================================
// ChartSummaryCard - AI-Generated Chart Summary
// ============================================

import { Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChartSummary } from '@/types';

interface ChartSummaryCardProps {
    summary: ChartSummary | null;
    isLoading: boolean;
    onGenerate: () => void;
}

export function ChartSummaryCard({ summary, isLoading, onGenerate }: ChartSummaryCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!summary) return;
        const text = `${summary.summary}\n\nKey Insights:\n${summary.keyInsights.map(i => `• ${i}`).join('\n')}`;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // No summary yet - show generate button
    if (!summary && !isLoading) {
        return (
            <div className="mt-4 flex justify-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onGenerate}
                    className="gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generate AI Summary
                </Button>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="mt-4 rounded-lg border border-border bg-card/50 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-4 rounded bg-primary/20" />
                    <div className="h-4 w-24 rounded bg-muted" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-4/5 rounded bg-muted" />
                    <div className="h-3 w-3/5 rounded bg-muted" />
                </div>
            </div>
        );
    }

    // Summary display
    return (
        <div className="mt-4 rounded-lg border border-border bg-card/50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">AI Summary</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                        }}
                    >
                        {copied ? (
                            <Check className="h-3 w-3 text-green-500" />
                        ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                            e.stopPropagation();
                            onGenerate();
                        }}
                    >
                        <RefreshCw className={cn("h-3 w-3 text-muted-foreground", isLoading && "animate-spin")} />
                    </Button>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && summary && (
                <div className="px-4 py-3 space-y-3">
                    {/* Main Summary */}
                    <p className="text-sm text-foreground/90 leading-relaxed">
                        {summary.summary}
                    </p>

                    {/* Key Insights */}
                    {summary.keyInsights.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Key Insights
                            </span>
                            <ul className="space-y-1">
                                {summary.keyInsights.map((insight, index) => (
                                    <li
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-foreground/80"
                                    >
                                        <span className="text-primary mt-1">•</span>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/50">
                        Generated {summary.generatedAt.toLocaleTimeString()}
                    </div>
                </div>
            )}
        </div>
    );
}
