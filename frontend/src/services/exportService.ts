// ============================================
// Export Service - Export Charts & Dashboards
// Supports PDF, PNG, and SVG formats
// Uses jsPDF for PDF, ECharts native export for images
// ============================================

import { jsPDF } from 'jspdf';

export interface ExportOptions {
    filename?: string;
    quality?: number;
    orientation?: 'portrait' | 'landscape';
    format?: 'a4' | 'letter' | 'legal';
}

export interface ImageExportOptions {
    filename?: string;
    pixelRatio?: 1 | 2 | 3;
    backgroundColor?: string;
}

/**
 * Download a data URL as a file
 */
function downloadDataURL(dataURL: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export chart canvas to PNG image
 * @param element - Container element containing the ECharts canvas
 * @param options - Export options including pixel ratio for resolution
 */
export function exportToPNG(
    element: HTMLElement,
    options: ImageExportOptions = {}
): void {
    const { filename = 'chart.png', pixelRatio = 2, backgroundColor = '#ffffff' } = options;

    try {
        // Find the canvas element
        const canvas = element.querySelector('canvas');
        if (!canvas) {
            throw new Error('No chart canvas found');
        }

        // Create a high-resolution copy if pixelRatio > 1
        if (pixelRatio > 1) {
            const scaledCanvas = document.createElement('canvas');
            const ctx = scaledCanvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            scaledCanvas.width = canvas.width * pixelRatio;
            scaledCanvas.height = canvas.height * pixelRatio;

            // Fill background
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);

            // Scale and draw
            ctx.scale(pixelRatio, pixelRatio);
            ctx.drawImage(canvas, 0, 0);

            const dataURL = scaledCanvas.toDataURL('image/png', 1.0);
            downloadDataURL(dataURL, filename);
        } else {
            // Create canvas with background
            const exportCanvas = document.createElement('canvas');
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;

            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            ctx.drawImage(canvas, 0, 0);

            const dataURL = exportCanvas.toDataURL('image/png', 1.0);
            downloadDataURL(dataURL, filename);
        }

        console.log('[Export] PNG generated successfully:', filename, `${pixelRatio}x resolution`);
    } catch (error) {
        console.error('[Export] PNG generation failed:', error);
        throw new Error('Failed to export PNG');
    }
}

/**
 * Export chart to SVG format
 * Note: This creates an SVG wrapper around the PNG data
 * For true vector SVG, ECharts must be initialized with renderer: 'svg'
 * @param element - Container element containing the ECharts canvas or SVG
 * @param options - Export options
 */
export function exportToSVG(
    element: HTMLElement,
    options: ImageExportOptions = {}
): void {
    const { filename = 'chart.svg', backgroundColor = '#ffffff' } = options;

    try {
        // First, check if there's a native SVG element (if ECharts uses SVG renderer)
        const svgElement = element.querySelector('svg');
        if (svgElement) {
            // Clone the SVG to avoid modifying the original
            const svgClone = svgElement.cloneNode(true) as SVGElement;

            // Add background rectangle
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', backgroundColor);
            svgClone.insertBefore(bg, svgClone.firstChild);

            // Add XML declaration and serialize
            const serializer = new XMLSerializer();
            const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(svgClone)}`;
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            downloadDataURL(url, filename);
            URL.revokeObjectURL(url);

            console.log('[Export] SVG generated successfully (native):', filename);
            return;
        }

        // Fall back to canvas-based export (embedded PNG in SVG)
        const canvas = element.querySelector('canvas');
        if (!canvas) {
            throw new Error('No chart element found');
        }

        // Create SVG with embedded image
        const width = canvas.width;
        const height = canvas.height;

        // Get PNG data from canvas
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        exportCanvas.width = width;
        exportCanvas.height = height;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(canvas, 0, 0);

        const pngData = exportCanvas.toDataURL('image/png', 1.0);

        // Create SVG wrapper with embedded PNG
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <image width="${width}" height="${height}" xlink:href="${pngData}"/>
</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        downloadDataURL(url, filename);
        URL.revokeObjectURL(url);

        console.log('[Export] SVG generated successfully (embedded PNG):', filename);
    } catch (error) {
        console.error('[Export] SVG generation failed:', error);
        throw new Error('Failed to export SVG');
    }
}

const DEFAULT_OPTIONS: ExportOptions = {
    filename: 'chart.pdf',
    quality: 0.95,
    orientation: 'landscape',
    format: 'a4',
};

/**
 * Export a single chart element to PDF
 * Uses ECharts getDataURL for reliable canvas capture
 */
export async function exportChartToPDF(
    element: HTMLElement,
    options: ExportOptions = {}
): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        // Find the canvas element within the chart container
        const canvas = element.querySelector('canvas');
        if (!canvas) {
            console.error('[Export] No canvas element found in chart container');
            throw new Error('No chart canvas found');
        }

        // Get the image data from canvas
        const imageData = canvas.toDataURL('image/png', opts.quality);

        // Create PDF
        const pdf = new jsPDF({
            orientation: opts.orientation,
            unit: 'mm',
            format: opts.format,
        });

        // Calculate dimensions to fit the page
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;

        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);

        // Get canvas aspect ratio
        const aspectRatio = canvas.width / canvas.height;

        let imgWidth = maxWidth;
        let imgHeight = maxWidth / aspectRatio;

        if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = maxHeight * aspectRatio;
        }

        // Center the image
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
        pdf.save(opts.filename || 'chart.pdf');

        console.log('[Export] PDF generated successfully:', opts.filename);
    } catch (error) {
        console.error('[Export] PDF generation failed:', error);
        throw new Error('Failed to generate PDF');
    }
}

/**
 * Export dashboard (multiple charts) to PDF
 * Each chart goes on its own page
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

    try {
        // Find all canvas elements (one per chart)
        const canvases = element.querySelectorAll('canvas');

        if (canvases.length === 0) {
            console.error('[Export] No canvas elements found in dashboard');
            throw new Error('No charts found in dashboard');
        }

        // Create PDF
        const pdf = new jsPDF({
            orientation: opts.orientation,
            unit: 'mm',
            format: opts.format,
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;

        // Add title on first page
        pdf.setFontSize(18);
        pdf.text(title, pageWidth / 2, margin, { align: 'center' });

        const maxWidth = pageWidth - (margin * 2);
        const chartHeight = (pageHeight - margin * 3) / 2; // 2 charts per page

        canvases.forEach((canvas, index) => {
            // Add new page for every 2 charts (after first pair)
            if (index > 0 && index % 2 === 0) {
                pdf.addPage();
            }

            try {
                const imageData = canvas.toDataURL('image/png', opts.quality);

                const aspectRatio = canvas.width / canvas.height;
                let imgWidth = maxWidth;
                let imgHeight = maxWidth / aspectRatio;

                if (imgHeight > chartHeight - 10) {
                    imgHeight = chartHeight - 10;
                    imgWidth = imgHeight * aspectRatio;
                }

                // Position: 2 charts per page, stacked vertically
                const positionOnPage = index % 2;
                const x = (pageWidth - imgWidth) / 2;
                const y = margin + (positionOnPage === 0 ? 10 : chartHeight + 5);

                pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
            } catch (canvasError) {
                console.warn(`[Export] Failed to export chart ${index + 1}:`, canvasError);
            }
        });

        pdf.save(opts.filename);
        console.log('[Export] Dashboard PDF generated successfully:', opts.filename);
    } catch (error) {
        console.error('[Export] Dashboard PDF generation failed:', error);
        throw new Error('Failed to generate dashboard PDF');
    }
}
