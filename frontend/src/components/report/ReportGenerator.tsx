import { FileText, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVizStore, selectReportData, selectReportLoading, selectShowReportModal } from '@/store/useVizStore';

export function ReportGenerator() {
    const reportData = useVizStore(selectReportData);
    const reportLoading = useVizStore(selectReportLoading);
    const showReportModal = useVizStore(selectShowReportModal);
    const { generateReport, downloadReport, setShowReportModal } = useVizStore();

    if (!showReportModal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-sm font-semibold text-slate-200">Data Report</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {reportData && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-white/5 border-white/10 text-slate-300"
                                onClick={downloadReport}
                            >
                                <Download className="h-3 w-3 mr-1.5" />
                                Download .md
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-white"
                            onClick={() => setShowReportModal(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-5">
                    {reportLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                            <p className="text-sm text-slate-400">Generating report...</p>
                        </div>
                    ) : reportData ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <h1 className="text-lg text-slate-100">{reportData.title}</h1>
                            <p className="text-xs text-slate-500">
                                Generated on {reportData.generatedAt.toLocaleString()}
                            </p>
                            {reportData.sections.filter(s => s.enabled).map((section, i) => (
                                <div key={i} className="mt-4">
                                    <h2 className="text-base text-slate-200 border-b border-white/10 pb-1">{section.title}</h2>
                                    <div className="mt-2 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                        {section.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <FileText className="w-12 h-12 text-slate-600" />
                            <p className="text-sm text-slate-400">Generate an AI-powered report from your data</p>
                            <Button
                                onClick={generateReport}
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Generate Report
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
