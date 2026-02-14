// ============================================
// CalculatedFieldDialog - Create derived fields with formulas
// ============================================

import { useState, useMemo } from 'react';
import { X, FunctionSquare, Plus, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVizStore, selectFields, selectDataset } from '@/store/useVizStore';
import { validateFormula } from '@backend/services/formulaParser';
import { cn } from '@/lib/utils';

interface CalculatedFieldDialogProps {
    open: boolean;
    onClose: () => void;
}

const FORMULA_EXAMPLES = [
    { label: 'Profit Margin', formula: '[Revenue] - [Cost]', description: 'Subtract one field from another' },
    { label: 'Percentage', formula: '[Value] / SUM([Value]) * 100', description: 'Calculate percentage of total' },
    { label: 'Conditional', formula: 'IF([Score] > 80, "High", "Low")', description: 'Conditional logic with IF' },
    { label: 'Concatenation', formula: 'CONCAT([First], " ", [Last])', description: 'Combine text fields' },
];

const FUNCTIONS_HELP = [
    { name: 'SUM(field)', desc: 'Sum of all values' },
    { name: 'AVG(field)', desc: 'Average of all values' },
    { name: 'MIN(field)', desc: 'Minimum value' },
    { name: 'MAX(field)', desc: 'Maximum value' },
    { name: 'COUNT(field)', desc: 'Number of rows' },
    { name: 'IF(cond, then, else)', desc: 'Conditional logic' },
    { name: 'CONCAT(a, b, ...)', desc: 'Join text values' },
    { name: 'ABS(value)', desc: 'Absolute value' },
    { name: 'ROUND(value, decimals)', desc: 'Round to decimals' },
    { name: 'SQRT(value)', desc: 'Square root' },
    { name: 'UPPER(text)', desc: 'Uppercase text' },
    { name: 'LOWER(text)', desc: 'Lowercase text' },
];

export function CalculatedFieldDialog({ open, onClose }: CalculatedFieldDialogProps) {
    const fields = useVizStore(selectFields);
    const dataset = useVizStore(selectDataset);
    const addCalculatedField = useVizStore(state => state.addCalculatedField);

    const [name, setName] = useState('');
    const [formula, setFormula] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const fieldNames = useMemo(() => fields.map(f => f.name), [fields]);

    const validation = useMemo(() => {
        if (!formula.trim()) return { valid: false, error: undefined };
        return validateFormula(formula, fieldNames);
    }, [formula, fieldNames]);

    const handleCreate = () => {
        if (!name.trim() || !validation.valid || !dataset) return;
        addCalculatedField(name.trim(), formula);
        setName('');
        setFormula('');
        onClose();
    };

    const insertField = (fieldName: string) => {
        setFormula(prev => prev + `[${fieldName}]`);
    };

    const insertFunction = (funcName: string) => {
        setFormula(prev => prev + funcName);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <FunctionSquare className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-slate-100">New Calculated Field</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-slate-400 hover:text-white">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="p-5 space-y-4 overflow-auto max-h-[60vh]">
                    {/* Field Name */}
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Field Name</label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g., Profit Margin"
                            className="h-8 bg-white/5 border-white/10 text-sm"
                        />
                    </div>

                    {/* Formula Input */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-slate-400">Formula</label>
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300"
                            >
                                {showHelp ? 'Hide Help' : 'Show Help'}
                            </button>
                        </div>
                        <Input
                            value={formula}
                            onChange={e => setFormula(e.target.value)}
                            placeholder="e.g., [Revenue] - [Cost]"
                            className={cn(
                                "h-8 bg-white/5 border-white/10 text-sm font-mono",
                                validation.error && formula.trim() && "border-red-500/50"
                            )}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                        {validation.error && formula.trim() && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-red-400">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                <span className="text-[10px]">{validation.error}</span>
                            </div>
                        )}
                        {validation.valid && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-emerald-400">
                                <Check className="w-3 h-3 flex-shrink-0" />
                                <span className="text-[10px]">Valid formula</span>
                            </div>
                        )}
                    </div>

                    {/* Available Fields - Clickable to insert */}
                    <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">Available Fields (click to insert)</label>
                        <div className="flex flex-wrap gap-1.5">
                            {fields.map(field => (
                                <button
                                    key={field.id}
                                    onClick={() => insertField(field.name)}
                                    className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-mono border transition-colors",
                                        field.type === 'quantitative'
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"
                                            : field.type === 'temporal'
                                                ? "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                                                : "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20"
                                    )}
                                >
                                    {field.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Functions Help */}
                    {showHelp && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">Functions (click to insert)</label>
                                <div className="grid grid-cols-2 gap-1">
                                    {FUNCTIONS_HELP.map(fn => (
                                        <button
                                            key={fn.name}
                                            onClick={() => insertFunction(fn.name.split('(')[0] + '(')}
                                            className="flex items-start gap-2 px-2 py-1.5 rounded text-left hover:bg-white/5 transition-colors"
                                        >
                                            <code className="text-[10px] text-violet-300 font-mono shrink-0">{fn.name}</code>
                                            <span className="text-[9px] text-slate-500">{fn.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">Examples</label>
                                <div className="space-y-1">
                                    {FORMULA_EXAMPLES.map(ex => (
                                        <button
                                            key={ex.label}
                                            onClick={() => {
                                                setFormula(ex.formula);
                                                if (!name.trim()) setName(ex.label);
                                            }}
                                            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div>
                                                <div className="text-[10px] text-slate-300 font-medium">{ex.label}</div>
                                                <code className="text-[9px] text-slate-500 font-mono">{ex.formula}</code>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Operators */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">Operators</label>
                                <p className="text-[10px] text-slate-500 font-mono">
                                    + - * / ( ) &gt; &lt; &gt;= &lt;= = !=
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Use <code className="text-violet-300">[Field Name]</code> brackets for fields with spaces
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-400">
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleCreate}
                        disabled={!name.trim() || !validation.valid}
                        className="text-xs bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Create Field
                    </Button>
                </div>
            </div>
        </div>
    );
}
