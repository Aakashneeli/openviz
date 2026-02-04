// Type declarations for html2pdf.js
declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | [number, number, number, number];
        filename?: string;
        image?: {
            type: 'jpeg' | 'png' | 'webp';
            quality?: number;
        };
        html2canvas?: {
            scale?: number;
            useCORS?: boolean;
            logging?: boolean;
            allowTaint?: boolean;
        };
        jsPDF?: {
            unit?: 'pt' | 'mm' | 'cm' | 'in';
            format?: 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'letter' | 'legal';
            orientation?: 'portrait' | 'landscape';
        };
        pagebreak?: {
            mode?: ('css' | 'legacy' | 'avoid-all' | 'slice')[];
            before?: string | string[];
            after?: string | string[];
            avoid?: string | string[];
        };
    }

    interface Html2PdfWorker {
        set(options: Html2PdfOptions): Html2PdfWorker;
        from(element: HTMLElement | string): Html2PdfWorker;
        save(): Promise<void>;
        outputPdf(type: 'blob' | 'datauristring'): Promise<Blob | string>;
    }

    function html2pdf(): Html2PdfWorker;
    function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Promise<void>;

    export default html2pdf;
}
