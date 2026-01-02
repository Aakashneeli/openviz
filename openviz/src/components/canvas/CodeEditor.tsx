// ============================================
// CodeEditor - JSON spec editor with Monaco
// ============================================

import { useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useVizStore, selectVegaSpec } from '@/store/useVizStore';

export function CodeEditor() {
    const vegaSpec = useVizStore(selectVegaSpec);
    const { updateSpecFromJson } = useVizStore();

    const specJson = useMemo(() => {
        if (!vegaSpec) {
            return JSON.stringify(
                {
                    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                    description: 'Add fields to encoding shelves to generate spec',
                    data: { values: [] },
                    mark: 'bar',
                    encoding: {},
                },
                null,
                2
            );
        }
        return JSON.stringify(vegaSpec, null, 2);
    }, [vegaSpec]);

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
                value={specJson}
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
