// ============================================
// Export Service - PDF Export for Charts & Dashboards
// ============================================

// Note: html2pdf.js is a browser-only library
// It will be bundled by Vite since backend/ is included in frontend build
import html2pdf from 'html2pdf.js';

export interface ExportOptions {
    filename?: string;
    quality?: number;
    scale?: number;
    margin?: number | [number, number, number, number];
    orientation?: 'portrait' | 'landscape';
    format?: 'a4' | 'letter' | 'legal';
}

const DEFAULT_OPTIONS: ExportOptions = {
    filename: 'chart.pdf',
    quality: 0.98,
    scale: 2,
    margin: 10,
    orientation: 'landscape',
    format: 'a4',
};

/**
 * Export a single chart element to PDF
 */
export async function exportChartToPDF(
    element: HTMLElement,
    options: ExportOptions = {}
): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const config = {
        margin: opts.margin,
        filename: opts.filename,
        image: { type: 'jpeg' as const, quality: opts.quality },
        html2canvas: {
            scale: opts.scale,
            useCORS: true,
            logging: false,
            allowTaint: true,
        },
        jsPDF: {
            unit: 'mm' as const,
            format: opts.format,
            orientation: opts.orientation
        },
    };

    try {
        await html2pdf().set(config).from(element).save();
        console.log('[Export] PDF generated successfully:', opts.filename);
    } catch (error) {
        console.error('[Export] PDF generation failed:', error);
        throw new Error('Failed to generate PDF');
    }
}

/**
 * Export dashboard (multiple charts) to PDF
 * Each chart can be on its own page or combined
 */
export async function exportDashboardToPDF(
    element: HTMLElement,
    title: string,
    options: ExportOptions = {}
): Promise<void> {
    const opts = {
        ...DEFAULT_OPTIONS,
        ...options,
        filename: options.filename || `${title.replace(/\s+/g, '_')}.pdf`,
    };

    const config = {
        margin: opts.margin,
        filename: opts.filename,
        image: { type: 'jpeg' as const, quality: opts.quality },
        html2canvas: {
            scale: opts.scale,
            useCORS: true,
            logging: false,
            allowTaint: true,
        },
        jsPDF: {
            unit: 'mm' as const,
            format: opts.format,
            orientation: opts.orientation
        },
        pagebreak: {
            mode: ['css', 'legacy'] as ('css' | 'legacy')[],
        },
    };

    try {
        await html2pdf().set(config).from(element).save();
        console.log('[Export] Dashboard PDF generated successfully:', opts.filename);
    } catch (error) {
        console.error('[Export] Dashboard PDF generation failed:', error);
        throw new Error('Failed to generate dashboard PDF');
    }
}
