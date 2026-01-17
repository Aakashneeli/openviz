// ============================================
// CodeEditor - ECharts option editor with Monaco
// ============================================

import { useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useVizStore, selectEChartsOption } from '@/store/useVizStore';

export function CodeEditor() {
    const echartsOption = useVizStore(selectEChartsOption);
    const { updateSpecFromJson } = useVizStore();

    const optionJson = useMemo(() => {
        if (!echartsOption) {
            return JSON.stringify(
                {
                    title: { text: 'ECharts Option' },
                    tooltip: { trigger: 'axis' },
                    xAxis: { type: 'category' },
                    yAxis: { type: 'value' },
                    series: [],
                    _info: 'Add fields to encoding shelves to generate option',
                },
                null,
                2
            );
        }
        return JSON.stringify(echartsOption, null, 2);
    }, [echartsOption]);

    const handleChange = useCallback(
        (value: string | undefined) => {
            if (!value) return;
            try {
                const parsed = JSON.parse(value);
                updateSpecFromJson(parsed);
            } catch {
                // Invalid JSON, ignore
            }
        },
        [updateSpecFromJson]
    );

    return (
        <div className="h-full w-full">
            <Editor
                height="100%"
                defaultLanguage="json"
                value={optionJson}
                onChange={handleChange}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    folding: true,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    formatOnPaste: true,
                    formatOnType: true,
                }}
            />
        </div>
    );
}
