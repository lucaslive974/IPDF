import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { PdfPageProxy } from '@ports/IPdfEngine';

/**
 * Canonical PDF document viewer port.
 * Extends IDocumentViewer with fixed-layout, canvas-based rasterization
 * and cooperative cancellation capabilities.
 */
export interface IPdfViewer extends IDocumentViewer {
  renderPageCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale?: number
  ): Promise<{ width: number; height: number }>;

  renderPageTextLayer(pageNumber: number, container: HTMLElement, scale?: number): Promise<void>;

  cancelPageRender?(canvas?: HTMLCanvasElement | null, container?: HTMLElement | null): void;

  getPageProxy(pageNumber: number): Promise<PdfPageProxy | null>;
}
