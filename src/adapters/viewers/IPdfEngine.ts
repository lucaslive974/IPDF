export interface PdfTextItem {
  readonly str: string;
  readonly dir?: string;
  readonly width?: number;
  readonly height?: number;
  readonly transform?: number[];
}

export interface PdfTextContent {
  readonly items: Array<{ readonly str: string } | PdfTextItem>;
}

export interface PdfViewport {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

export interface PdfRenderTask {
  readonly promise: Promise<void>;
  cancel?(): void;
}

export interface PdfPageProxy {
  readonly pageNumber: number;
  getViewport(options: { scale: number }): PdfViewport;
  getTextContent(): Promise<PdfTextContent>;
  render?(options: {
    canvasContext: unknown;
    viewport: unknown;
  }): PdfRenderTask;
}

export interface PdfDocumentProxy {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy?(): Promise<void> | void;
}

export interface IPdfEngine {
  loadDocument(source: ArrayBuffer | string): Promise<PdfDocumentProxy>;
}
