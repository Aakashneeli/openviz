import { v4 as uuidv4 } from 'uuid';
import type {
    FieldInfo,
    ShelfPlacement,
    ChartConfig,
    ChartSuggestion,
    DataInsight,
    AIMessage,
    ChartSummary,
    DashboardSummary,
    ChartRecommendation,
} from '@backend/types';
import { toast } from '@/lib/toast';
import type { StoreSet, StoreGet } from './types';
import { initialChartConfig } from './chartSlice';

// ============================================
// AI Slice
// ============================================

export const createAISlice = (set: StoreSet, get: StoreGet) => ({
    // State defaults
    aiQuery: '',
    aiChatOpen: false,
    aiFocusedChartId: null as string | null,
    aiLoading: false,
    aiStreamingMessageId: null as string | null,
    aiStreamingText: '',
    lastFailedQuery: null as string | null,
    aiSuggestions: [] as ChartSuggestion[],
    aiInsights: [] as DataInsight[],
    aiChatHistory: [] as AIMessage[],
    chartSummary: null as ChartSummary | null,
    dashboardSummary: null as DashboardSummary | null,
    summaryLoading: false,
    chartRecommendations: [] as ChartRecommendation[],
    recommendationsLoading: false,

    // Actions

    setAIQuery: (query: string) => {
        set({ aiQuery: query });
    },

    processAIQuery: async (query: string) => {
        const state = get() as any;
        const { dataset, dataProfile, encodings, aiChatHistory } = state;

        if (!dataset || !dataProfile) {
            console.error('No dataset or data profile loaded');
            return;
        }

        set({ aiLoading: true, aiQuery: query });

        // Add user message to chat history
        const userMessage: AIMessage = {
            id: uuidv4(),
            role: 'user',
            content: query,
            timestamp: new Date(),
        };
        (get() as any).addChatMessage(userMessage);

        try {
            // Use the streaming AI service for real-time text responses
            const { processAIQueryStreaming } = await import('@backend/services/groqService');
            const { dashboardConfig, chartConfig, aiFocusedChartId } = get() as any;

            // If chat is focused on a specific chart in a dashboard, use that chart's context
            let contextMark = chartConfig?.mark || 'bar';
            let contextTitle = chartConfig?.title;
            let contextEncodings = encodings;
            let focusedChartConfig: ChartConfig | undefined;

            if (aiFocusedChartId && dashboardConfig) {
                focusedChartConfig = dashboardConfig.charts.find((c: ChartConfig) => c.id === aiFocusedChartId);
                if (focusedChartConfig) {
                    contextMark = focusedChartConfig.mark;
                    contextTitle = focusedChartConfig.title;
                    contextEncodings = focusedChartConfig.encodings;
                }
            }

            // Create a streaming message placeholder before calling AI
            // This allows streaming callbacks to populate it progressively
            const streamMsgId = uuidv4();
            let isStreamingActive = false;

            const onChunk = (_chunk: string, accumulated: string) => {
                // On first chunk, set up the streaming message if not already done
                if (!isStreamingActive) {
                    isStreamingActive = true;
                    const streamMessage: AIMessage = {
                        id: streamMsgId,
                        role: 'assistant',
                        content: '',
                        timestamp: new Date(),
                        resultType: 'text',
                    };
                    (get() as any).addChatMessage(streamMessage);
                    set({ aiStreamingMessageId: streamMsgId, aiStreamingText: '' });
                }

                // Update streaming text and the message in chat history
                set({ aiStreamingText: accumulated });
                const history = (get() as any).aiChatHistory;
                set({
                    aiChatHistory: history.map((m: AIMessage) =>
                        m.id === streamMsgId ? { ...m, content: accumulated } : m
                    ),
                });
            };

            const result = await processAIQueryStreaming(
                query,
                dataProfile,
                dataset.fields,
                dataset.data,
                contextEncodings,
                aiChatHistory,
                dashboardConfig,
                contextMark,
                contextTitle,
                aiFocusedChartId,
                onChunk
            );

            // If the response was streamed, finalize the streaming state
            if (result.streamed && result.textAnswer) {
                const finalHistory = (get() as any).aiChatHistory;
                set({
                    aiChatHistory: finalHistory.map((m: AIMessage) =>
                        m.id === streamMsgId ? { ...m, content: result.textAnswer!, provider: result.provider } : m
                    ),
                    aiStreamingMessageId: null,
                    aiStreamingText: '',
                });
            } else if (result.streamed && result.error) {
                // Streamed intent that errored - show error
                // Clean up partial streaming message if it was added
                if (isStreamingActive) {
                    const h = (get() as any).aiChatHistory;
                    set({
                        aiChatHistory: h.filter((m: AIMessage) => m.id !== streamMsgId),
                        aiStreamingMessageId: null,
                        aiStreamingText: '',
                    });
                }
                const errorMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: `Error: ${result.error}`,
                    timestamp: new Date(),
                    resultType: 'error',
                };
                (get() as any).addChatMessage(errorMessage);
            } else if (!result.streamed && result.intent === 'question' && result.textAnswer) {
                // Fallback: non-streamed text answer (shouldn't happen, but just in case)
                const msgId = uuidv4();
                const assistantMessage: AIMessage = {
                    id: msgId,
                    role: 'assistant',
                    content: result.textAnswer,
                    timestamp: new Date(),
                    resultType: 'text',
                };
                (get() as any).addChatMessage(assistantMessage);
            } else if (result.chartConfig) {
                // Chart creation or modification
                (get() as any).pushToHistory(); // Save for undo

                const { dashboardConfig: dc, viewMode, aiFocusedChartId: focusId } = get() as any;

                if (focusId && dc) {
                    // AI is modifying a specific chart in the dashboard
                    const updatedChart = { ...result.chartConfig!, id: focusId, encodings: result.chartConfig!.encodings };
                    const updatedCharts = dc.charts.map((c: ChartConfig) =>
                        c.id === focusId ? updatedChart : c
                    );
                    set({
                        dashboardConfig: { ...dc, charts: updatedCharts },
                    });
                    (get() as any).saveDashboard();

                    // If this chart is maximized (editing in single view), also update the live preview
                    const { editingChartId } = get() as any;
                    if (editingChartId === focusId) {
                        set({
                            chartConfig: updatedChart,
                            encodings: [...updatedChart.encodings],
                        });
                        (get() as any).regenerateSpec();
                    }

                    const chartName = result.chartConfig.title || dc.charts.find((c: ChartConfig) => c.id === focusId)?.title || 'chart';
                    const assistantMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: result.textAnswer || `Updated "${chartName}" in dashboard`,
                        timestamp: new Date(),
                        resultType: 'chart',
                        chartConfig: result.chartConfig,
                        echartsOption: editingChartId === focusId ? (get() as any).echartsOption || undefined : undefined,
                        provider: result.provider,
                    };
                    (get() as any).addChatMessage(assistantMessage);
                } else if (viewMode === 'dashboard' && dc) {
                    // Add chart to dashboard
                    (get() as any).addChartToDashboard(result.chartConfig);

                    const assistantMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: result.textAnswer || `Added ${result.chartConfig.mark} chart to dashboard`,
                        timestamp: new Date(),
                        resultType: 'chart',
                        provider: result.provider,
                    };
                    (get() as any).addChatMessage(assistantMessage);
                } else {
                    // Normal chart creation in single mode
                    set({
                        chartConfig: result.chartConfig,
                        encodings: result.chartConfig.encodings,
                    });
                    (get() as any).regenerateSpec();

                    // Get the generated ECharts option for transparency mode
                    const generatedOption = (get() as any).echartsOption;

                    const assistantMessage: AIMessage = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: result.textAnswer || `Created ${result.chartConfig.mark} chart`,
                        timestamp: new Date(),
                        resultType: 'chart',
                        chartConfig: result.chartConfig,
                        echartsOption: generatedOption || undefined,
                        provider: result.provider,
                    };
                    (get() as any).addChatMessage(assistantMessage);
                }
            } else if (result.dashboardConfig) {
                // Dashboard creation -- save previous dashboard if any
                const { dashboardConfig: prevDashboard } = get() as any;
                if (prevDashboard) {
                    (get() as any).saveDashboard();
                }

                set({
                    dashboardConfig: result.dashboardConfig,
                    viewMode: 'dashboard',
                    editingChartId: null,
                    chartConfig: { ...initialChartConfig, id: uuidv4() },
                    encodings: [],
                    echartsOption: null,
                });
                (get() as any).saveDashboard();

                const assistantMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: result.textAnswer || 'Created dashboard',
                    timestamp: new Date(),
                    resultType: 'dashboard',
                    provider: result.provider,
                };
                (get() as any).addChatMessage(assistantMessage);
            } else if (result.error) {
                const errorMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: `Error: ${result.error}`,
                    timestamp: new Date(),
                    resultType: 'error',
                };
                (get() as any).addChatMessage(errorMessage);
            }

            // Handle filter result
            if (result.filterSpec) {
                (get() as any).applyFilter(result.filterSpec);
                const filterText = result.textAnswer || 'Filter applied';
                const filterMessage: AIMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: filterText,
                    timestamp: new Date(),
                    resultType: 'text',
                };
                (get() as any).addChatMessage(filterMessage);
            }

            // Handle comparison result
            if (result.comparisonSpec && result.comparisonResult) {
                set({
                    comparisonMode: true,
                    comparisonSpec: result.comparisonSpec,
                    comparisonResult: result.comparisonResult,
                });
            }

            // Handle forecast result
            if (result.forecastResult) {
                set({ forecastData: result.forecastResult });
                // Regenerate spec if chart was also created
                if (result.chartConfig) {
                    (get() as any).regenerateSpec();
                }
            }

            if (result.insights) {
                set({ aiInsights: result.insights });
            }

            // Clear last failed query on success
            set({ lastFailedQuery: null });

        } catch (error) {
            console.error('AI Query Error:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';

            // Store the failed query for retry
            set({ lastFailedQuery: query });

            // Create user-friendly error message
            const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch');
            const isRateLimitError = errorMsg.includes('429') || errorMsg.includes('rate limit');
            const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('timed out');

            let friendlyMessage = 'Sorry, I encountered an error processing your request.';
            if (isNetworkError) {
                friendlyMessage = 'Unable to connect to the AI service. Please check your internet connection and try again.';
            } else if (isRateLimitError) {
                friendlyMessage = 'The AI service is temporarily busy. Please wait a moment and try again.';
            } else if (isTimeout) {
                friendlyMessage = 'The request took too long to complete. Please try a simpler query or try again.';
            } else if (errorMsg.includes('API key')) {
                friendlyMessage = 'AI service is not configured. Please check your API key settings.';
            }

            const errorMessage: AIMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: friendlyMessage,
                timestamp: new Date(),
                resultType: 'error',
            };
            (get() as any).addChatMessage(errorMessage);

            // Show error toast with retry hint
            toast.error('AI query failed', {
                description: 'Click "Retry" in the chat to try again.',
            });
        } finally {
            set({ aiLoading: false, aiStreamingMessageId: null, aiStreamingText: '' });
        }
    },

    retryLastQuery: async () => {
        const state = get() as any;
        const { lastFailedQuery } = state;
        if (!lastFailedQuery) return;

        // Remove the last error message from chat history before retrying
        const { aiChatHistory } = get() as any;
        const lastMessage = aiChatHistory[aiChatHistory.length - 1];
        if (lastMessage?.resultType === 'error') {
            set({ aiChatHistory: aiChatHistory.slice(0, -1) });
        }
        // Also remove the user's last message so it doesn't duplicate
        const updatedHistory = (get() as any).aiChatHistory;
        const lastUserMessage = updatedHistory[updatedHistory.length - 1];
        if (lastUserMessage?.role === 'user') {
            set({ aiChatHistory: updatedHistory.slice(0, -1) });
        }

        // Retry the query
        await (get() as any).processAIQuery(lastFailedQuery);
    },

    applySuggestion: (suggestion: ChartSuggestion) => {
        set({
            chartConfig: suggestion.config,
            encodings: suggestion.config.encodings,
        });
        (get() as any).regenerateSpec();
    },

    generateInsights: async () => {
        set({ aiLoading: true });

        try {
            const { generateDataInsights } = await import('@backend/services/groqService');
            const state = get() as any;
            const { dataset } = state;

            if (!dataset) {
                throw new Error('No dataset loaded');
            }

            const insights = await generateDataInsights(dataset.data, dataset.fields);
            set({ aiInsights: insights });

        } catch (error) {
            console.error('Generate Insights Error:', error);
        } finally {
            set({ aiLoading: false });
        }
    },

    addChatMessage: (message: AIMessage) => {
        set((state: any) => ({ aiChatHistory: [...state.aiChatHistory, message] }));
    },

    clearChatHistory: () => set({ aiChatHistory: [] }),

    setMessageFeedback: (messageId: string, feedback: 'positive' | 'negative') => {
        const state = get() as any;
        const { aiChatHistory } = state;
        const updated = aiChatHistory.map((msg: AIMessage) =>
            msg.id === messageId ? { ...msg, feedback } : msg
        );
        set({ aiChatHistory: updated });

        // Persist feedback to localStorage
        try {
            const key = 'openviz-ai-feedback';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push({
                messageId,
                feedback,
                timestamp: new Date().toISOString(),
                content: aiChatHistory.find((m: AIMessage) => m.id === messageId)?.content?.slice(0, 200),
            });
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {
            console.warn('Failed to save AI feedback:', e);
        }
    },

    setAIChatOpen: (isOpen: boolean) => set({ aiChatOpen: isOpen }),

    toggleAIChat: () => set((state: any) => ({ aiChatOpen: !state.aiChatOpen })),

    openChatForChart: (chartId: string) => {
        set({
            aiChatOpen: true,
            aiFocusedChartId: chartId,
            aiChatHistory: [], // Fresh chat for this chart context
        });
    },

    clearChatFocus: () => {
        set({ aiFocusedChartId: null });
    },

    generateChartSummary: async () => {
        const state = get() as any;
        const { dataset, dataProfile, chartConfig, encodings } = state;

        if (!dataset || !dataProfile || encodings.length === 0) {
            console.error('Cannot generate summary: no chart configured');
            return;
        }

        set({ summaryLoading: true });

        try {
            const { generateChartSummary } = await import('@backend/services/groqService');
            const configWithEncodings = { ...chartConfig, encodings };
            const result = await generateChartSummary(configWithEncodings, dataProfile, dataset.data);

            const summary: ChartSummary = {
                id: uuidv4(),
                chartId: chartConfig.id,
                summary: result.summary,
                keyInsights: result.keyInsights,
                generatedAt: new Date(),
            };

            set({ chartSummary: summary });
        } catch (error) {
            console.error('Chart Summary Error:', error);
        } finally {
            set({ summaryLoading: false });
        }
    },

    generateDashboardSummary: async () => {
        const state = get() as any;
        const { dataset, dataProfile, dashboardConfig } = state;

        if (!dataset || !dataProfile || !dashboardConfig) {
            console.error('Cannot generate summary: no dashboard configured');
            return;
        }

        set({ summaryLoading: true });

        try {
            const { generateDashboardSummary } = await import('@backend/services/groqService');
            const result = await generateDashboardSummary(dashboardConfig, dataProfile, dataset.data);

            // Check if the result is an error - look for the specific error message
            if (result.overview.includes('Failed to generate')) {
                console.error('Dashboard summary generation failed:', result.overview);
                // Don't update the summary if it's an error - keep existing summary
                return;
            }

            const chartSummaries: ChartSummary[] = result.chartSummaries.map((cs: any) => ({
                id: uuidv4(),
                chartId: cs.chartId,
                summary: cs.summary,
                keyInsights: [],
                generatedAt: new Date(),
            }));

            const summary: DashboardSummary = {
                id: uuidv4(),
                dashboardId: dashboardConfig.id,
                overview: result.overview,
                chartSummaries,
                keyTakeaways: result.keyTakeaways,
                generatedAt: new Date(),
            };

            set({ dashboardSummary: summary });
        } catch (error) {
            console.error('Dashboard Summary Error:', error);
            // Don't update state on error - keep existing summary
        } finally {
            set({ summaryLoading: false });
        }
    },

    clearSummaries: () => {
        set({ chartSummary: null, dashboardSummary: null });
    },

    generateRecommendations: () => {
        const state = get() as any;
        const { dataset } = state;
        if (!dataset) return;

        set({ recommendationsLoading: true });
        try {
            // Dynamic import to avoid circular deps
            import('@backend/services/recommendationService').then(({ generateRecommendations }) => {
                const recs = generateRecommendations(dataset.fields, dataset.data, 5);
                set({ chartRecommendations: recs, recommendationsLoading: false });
            });
        } catch {
            set({ recommendationsLoading: false });
        }
    },

    applyRecommendation: (rec: ChartRecommendation) => {
        const state = get() as any;
        const { dataset } = state;
        if (!dataset) return;

        const xField = dataset.fields.find((f: FieldInfo) => f.name === rec.xField);
        const yField = dataset.fields.find((f: FieldInfo) => f.name === rec.yField);
        if (!xField || !yField) return;

        (get() as any).pushToHistory();

        const encodings: ShelfPlacement[] = [
            { id: uuidv4(), field: xField, channel: 'x' },
            { id: uuidv4(), field: yField, channel: 'y', aggregate: yField.type === 'quantitative' ? 'sum' : undefined },
        ];

        if (rec.colorField) {
            const colorField = dataset.fields.find((f: FieldInfo) => f.name === rec.colorField);
            if (colorField) {
                encodings.push({ id: uuidv4(), field: colorField, channel: 'color' });
            }
        }

        // Generate a short, clean title (max ~40 chars)
        const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
        const shortTitle = `${truncate(rec.yField, 18)} by ${truncate(rec.xField, 15)}`;

        set({
            chartConfig: { ...(get() as any).chartConfig, mark: rec.mark, title: shortTitle },
            encodings,
        });
        (get() as any).regenerateSpec();
    },

    dismissRecommendation: (id: string) => {
        set((state: any) => ({
            chartRecommendations: state.chartRecommendations.filter((r: ChartRecommendation) => r.id !== id),
        }));
    },
});
