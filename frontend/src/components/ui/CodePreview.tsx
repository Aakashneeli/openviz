// ============================================
// CodePreview - Syntax highlighted JSON viewer
// Phase 1.2: Transparency Mode
// ============================================

import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CodePreviewProps {
    code: object | string;
    title?: string;
    defaultExpanded?: boolean;
    className?: string;
}

export function CodePreview({ code, title = 'Generated Code', defaultExpanded = false, className }: CodePreviewProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [copied, setCopied] = useState(false);

    const codeString = typeof code === 'string' ? code : JSON.stringify(code, null, 2);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <div className={cn("rounded-lg border border-white/10 bg-black/30 overflow-hidden", className)}>
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">{title}</span>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Copy to clipboard"
                >
                    {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                </button>
            </button>

            {/* Code Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">
                            <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded bg-black/50 border border-white/5 max-h-[300px] overflow-y-auto">
                                <code className="text-slate-300 font-mono">
                                    {highlightJSON(codeString)}
                                </code>
                            </pre>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * Simple JSON syntax highlighting without external dependencies
 */
function highlightJSON(jsonString: string): React.ReactNode[] {
    const lines = jsonString.split('\n');

    return lines.map((line, i) => {
        // Simple regex-based highlighting
        const highlighted = line
            // String values
            .replace(/"([^"]+)"\s*:/g, '<key>"$1"</key>:')
            .replace(/:\s*"([^"]*)"/g, ': <string>"$1"</string>')
            // Numbers
            .replace(/:\s*(\d+\.?\d*)/g, ': <number>$1</number>')
            // Booleans
            .replace(/:\s*(true|false)/g, ': <bool>$1</bool>')
            // Null
            .replace(/:\s*(null)/g, ': <null>$1</null>');

        return (
            <span key={i}>
                {highlighted.split(/(<key>.*?<\/key>|<string>.*?<\/string>|<number>.*?<\/number>|<bool>.*?<\/bool>|<null>.*?<\/null>)/).map((part, j) => {
                    if (part.startsWith('<key>')) {
                        return <span key={j} className="text-indigo-400">{part.replace(/<\/?key>/g, '')}</span>;
                    }
                    if (part.startsWith('<string>')) {
                        return <span key={j} className="text-emerald-400">{part.replace(/<\/?string>/g, '')}</span>;
                    }
                    if (part.startsWith('<number>')) {
                        return <span key={j} className="text-amber-400">{part.replace(/<\/?number>/g, '')}</span>;
                    }
                    if (part.startsWith('<bool>')) {
                        return <span key={j} className="text-purple-400">{part.replace(/<\/?bool>/g, '')}</span>;
                    }
                    if (part.startsWith('<null>')) {
                        return <span key={j} className="text-red-400">{part.replace(/<\/?null>/g, '')}</span>;
                    }
                    return part;
                })}
                {i < lines.length - 1 && '\n'}
            </span>
        );
    });
}
