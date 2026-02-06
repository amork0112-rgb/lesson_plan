declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | number[];
        filename?: string;
        image?: { type: string; quality: number };
        html2canvas?: any;
        jsPDF?: any;
        pagebreak?: any;
    }

    interface Html2PdfWorker {
        from(element: HTMLElement): Html2PdfWorker;
        set(options: Html2PdfOptions): Html2PdfWorker;
        output(type: string): Promise<Blob>;
        save(): void;
        toPdf(): Html2PdfWorker;
        get(type: string): Promise<any>;
    }

    function html2pdf(): Html2PdfWorker;
    export default html2pdf;
}
