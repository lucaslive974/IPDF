import type { IPdfEngine, PdfDocumentProxy } from '@ports/IPdfEngine';
import { hasWindow } from '@utils/dom';

export class DefaultPdfEngine implements IPdfEngine {
  private ensureWorkerConfigured(pdfjsLib: typeof import('pdfjs-dist')): void {
    if (hasWindow() && 'GlobalWorkerOptions' in pdfjsLib) {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
        } catch {
          // Gracefully fallback if worker URL cannot be constructed
        }
      }
    }
  }

  public async loadDocument(source: ArrayBuffer | string): Promise<PdfDocumentProxy> {
    const pdfjsLib = await import('pdfjs-dist');
    this.ensureWorkerConfigured(pdfjsLib);

    const sourceParam =
      typeof source === 'string'
        ? { url: source, useSystemFonts: true }
        : { data: new Uint8Array(source), useSystemFonts: true };

    const loadingTask = pdfjsLib.getDocument(sourceParam);
    const doc = await loadingTask.promise;
    return doc as unknown as PdfDocumentProxy;
  }
}
