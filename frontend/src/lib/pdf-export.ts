export type PdfExportPreset = 'standard' | 'high';

interface ExportElementToPdfOptions {
    filename: string;
    preset?: PdfExportPreset;
    scale?: number;
    backgroundColor?: string;
    orientation?: 'portrait' | 'landscape';
    format?: string;
    marginTop?: number;
    imageType?: 'PNG' | 'JPEG';
    imageQuality?: number;
    imageCompression?: 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW';
}

export async function exportElementToPdf(
    element: HTMLElement,
    {
        filename,
        preset = 'standard',
        scale,
        backgroundColor = '#ffffff',
        orientation = 'portrait',
        format = 'a4',
        marginTop = 10,
        imageType,
        imageQuality,
        imageCompression,
    }: ExportElementToPdfOptions,
) {
    const resolvedScale = scale ?? (preset === 'high' ? 2 : 1.5);
    const resolvedImageType = imageType ?? 'JPEG';
    const resolvedImageQuality = imageQuality ?? (preset === 'high' ? 0.92 : 0.82);
    const resolvedImageCompression = imageCompression ?? (preset === 'high' ? 'MEDIUM' : 'FAST');

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ]);

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = `${element.offsetWidth}px`;
    document.body.appendChild(clone);

    try {
        const canvas = await html2canvas(clone, {
            scale: resolvedScale,
            useCORS: true,
            logging: false,
            backgroundColor,
        });

        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format,
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const availablePageHeight = pageHeight - marginTop * 2;
        const pageCanvasHeight = Math.max(1, Math.floor((availablePageHeight * canvas.width) / pdfWidth));
        const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

        for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
            const sourceY = pageIndex * pageCanvasHeight;
            const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeight;

            const pageContext = pageCanvas.getContext('2d');
            if (!pageContext) {
                throw new Error('Unable to prepare PDF page canvas');
            }

            pageContext.fillStyle = backgroundColor;
            pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageContext.drawImage(
                canvas,
                0,
                sourceY,
                canvas.width,
                sliceHeight,
                0,
                0,
                pageCanvas.width,
                pageCanvas.height,
            );

            const outputMimeType = resolvedImageType === 'PNG' ? 'image/png' : 'image/jpeg';
            const imageData =
                resolvedImageType === 'PNG'
                    ? pageCanvas.toDataURL(outputMimeType)
                    : pageCanvas.toDataURL(outputMimeType, resolvedImageQuality);
            const renderedHeight = (sliceHeight * pdfWidth) / canvas.width;

            if (pageIndex > 0) {
                pdf.addPage();
            }

            pdf.addImage(
                imageData,
                resolvedImageType,
                0,
                marginTop,
                pdfWidth,
                renderedHeight,
                undefined,
                resolvedImageCompression,
            );
        }

        pdf.save(filename);
    } finally {
        document.body.removeChild(clone);
    }
}
