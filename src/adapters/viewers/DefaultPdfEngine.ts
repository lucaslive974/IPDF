import type { IPdfEngine, PdfDocumentProxy, PdfRangeSource } from '@ports/IPdfEngine';
import { hasWindow } from '@utils/dom';
import { GlobalWorkerOptions, PDFDataRangeTransport, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const RANGE_CHUNK_SIZE_BYTES = 65536;

class OnDemandPdfRangeTransport extends PDFDataRangeTransport {
  private readonly source: PdfRangeSource;
  private aborted = false;

  public constructor(source: PdfRangeSource) {
    super(source.totalBytes, null);
    this.source = source;
  }

  public override requestDataRange(begin: number, end: number): void {
    void this.source
      .readRange(begin, end)
      .then((chunk: Uint8Array) => {
        if (!this.aborted) {
          this.onDataRange(begin, chunk);
        }
      })
      .catch(() => {
        // Range read failures are handled by PDF.js loadingTask.promise rejection
      });
  }

  public override abort(): void {
    this.aborted = true;
  }
}

export class DefaultPdfEngine implements IPdfEngine {
  private ensureWorkerConfigured(workerOptions: { workerSrc: string } = GlobalWorkerOptions): void {
    if (hasWindow() && !workerOptions.workerSrc) {
      workerOptions.workerSrc = pdfWorkerUrl;
    }
  }

  public async loadDocument(source: PdfRangeSource): Promise<PdfDocumentProxy> {
    this.ensureWorkerConfigured();

    const rangeTransport = new OnDemandPdfRangeTransport(source);
    const loadingTask = getDocument({
      range: rangeTransport,
      rangeChunkSize: RANGE_CHUNK_SIZE_BYTES,
      disableStream: true,
      disableAutoFetch: true,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    return doc as unknown as PdfDocumentProxy;
  }
}
