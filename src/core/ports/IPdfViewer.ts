import type { DocumentPage, IDocumentViewer } from '@ports/IDocumentViewer';
import type { PdfPageProxy } from '@ports/IPdfEngine';

/**
 * Canonical PDF document viewer port.
 * Extends IDocumentViewer with fixed-layout, canvas-based rasterization
 * and structural page extraction capabilities without duck typing.
 */
export interface IPdfViewer extends IDocumentViewer {
  renderPageCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale?: number
  ): Promise<{ width: number; height: number }>;

  renderPageTextLayer(pageNumber: number, container: HTMLElement, scale?: number): Promise<void>;

  ensurePagesExtracted(startPage: number, count: number): Promise<DocumentPage[]>;

  getPageProxy(pageNumber: number): Promise<PdfPageProxy | null>;
}
