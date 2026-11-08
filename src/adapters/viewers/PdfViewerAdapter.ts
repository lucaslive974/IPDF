import type { PageInfo } from '@domain/types';
import type { DocumentPage } from '@ports/IDocumentViewer';
import type { IPdfEngine, PdfDocumentProxy, PdfPageProxy, PdfRenderTask } from '@ports/IPdfEngine';
import type { IPdfViewer } from '@ports/IPdfViewer';
import { getDevicePixelRatio, hasDocument, isBrowser } from '@utils/dom';
import { DefaultPdfEngine } from './DefaultPdfEngine';

export class PdfViewerAdapter implements IPdfViewer {
  private container: HTMLElement | null = null;
  private readonly engine: IPdfEngine;
  private documentProxy: PdfDocumentProxy | null = null;
  private pages: DocumentPage[] = [];
  private currentPageIndex = 0;
  private readonly pageChangedListeners: Array<(pageInfo: PageInfo) => void> = [];
  private readonly inFlightCanvasTasks = new WeakMap<HTMLCanvasElement, PdfRenderTask>();
  private readonly inFlightTextTasks = new WeakMap<HTMLElement, { cancel(): void }>();

  public constructor(engine?: IPdfEngine) {
    this.engine = engine ?? new DefaultPdfEngine();
  }

  public async render(container: HTMLElement, fileData: ArrayBuffer | string): Promise<void> {
    this.container = container;
    this.documentProxy = await this.engine.loadDocument(fileData);
    const total = this.documentProxy.numPages;

    this.pages = Array.from({ length: total }, (_, idx) => ({
      pageNumber: idx + 1,
      chapterTitle: `Page ${idx + 1}`,
      paragraphs: [`[Page ${idx + 1}]`],
      cfiBase: `page-${idx + 1}`,
    }));

    this.currentPageIndex = 0;
    this.emitPageChanged();
  }

  public setPages(pages: DocumentPage[]): void {
    this.pages = pages;
    this.emitPageChanged();
  }

  public getPage(pageNumber: number): DocumentPage | null {
    if (pageNumber < 1 || pageNumber > this.pages.length) {
      return null;
    }
    return this.pages[pageNumber - 1] ?? null;
  }

  public getPagesChunk(startPage: number, count: number): DocumentPage[] {
    const startIndex = Math.max(0, startPage - 1);
    return this.pages.slice(startIndex, startIndex + count);
  }

  public async getPageProxy(pageNumber: number): Promise<PdfPageProxy | null> {
    if (!this.documentProxy || pageNumber < 1 || pageNumber > this.documentProxy.numPages) {
      return null;
    }
    return this.documentProxy.getPage(pageNumber);
  }

  private async abortCanvasTask(canvas: HTMLCanvasElement): Promise<void> {
    const inFlight = this.inFlightCanvasTasks.get(canvas);
    if (!inFlight) return;
    try {
      inFlight.cancel?.();
    } catch {
      // Ignore cancellation errors
    }
    try {
      await inFlight.promise;
    } catch {
      // Previous task was cancelled, ignore
    }
  }

  private abortTextTask(container: HTMLElement): void {
    const inFlight = this.inFlightTextTasks.get(container);
    if (!inFlight) return;
    try {
      inFlight.cancel();
    } catch {
      // TextLayer abort is expected
    } finally {
      this.inFlightTextTasks.delete(container);
    }
  }

  public async renderPageCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    targetScale = 1.5
  ): Promise<{ width: number; height: number }> {
    const pageProxy = await this.getPageProxy(pageNumber);
    if (!pageProxy) {
      return { width: 0, height: 0 };
    }

    if (this.inFlightCanvasTasks.has(canvas)) {
      await this.abortCanvasTask(canvas);
    }

    const dpr = getDevicePixelRatio();
    const scale = targetScale * dpr;
    const viewport = pageProxy.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const cssViewport = pageProxy.getViewport({ scale: targetScale });
    if (canvas.style) {
      canvas.style.width = '100%';
      canvas.style.height = `${cssViewport.height}px`;
    }

    const context = canvas.getContext('2d');
    if (context && pageProxy.render) {
      const task = pageProxy.render({
        canvasContext: context,
        viewport,
      });
      this.inFlightCanvasTasks.set(canvas, task);

      try {
        await task.promise;
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          err.name === 'RenderingCancelledException'
        ) {
          return { width: 0, height: 0 };
        }
        throw err;
      } finally {
        if (this.inFlightCanvasTasks.get(canvas) === task) {
          this.inFlightCanvasTasks.delete(canvas);
        }
      }
    }

    return { width: viewport.width, height: viewport.height };
  }

  public async renderPageTextLayer(
    pageNumber: number,
    container: HTMLElement,
    targetScale = 1.5
  ): Promise<void> {
    const pageProxy = await this.getPageProxy(pageNumber);
    if (!pageProxy) {
      return;
    }

    this.abortTextTask(container);

    const viewport = pageProxy.getViewport({ scale: targetScale });

    if (container) {
      container.innerHTML = '';
      if (container.style) {
        container.style.setProperty('--scale-factor', `${targetScale}`);
        container.style.setProperty('--total-scale-factor', `${targetScale}`);
        container.style.setProperty('--user-unit', '1');
        container.style.setProperty('--scale-round-x', '1px');
        container.style.setProperty('--scale-round-y', '1px');
        container.style.width = '100%';
        container.style.height = `${viewport.height}px`;
      }
    }

    const textContent = await pageProxy.getTextContent();

    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.TextLayer && isBrowser()) {
        type TextLayerParams = ConstructorParameters<typeof pdfjsLib.TextLayer>[0];
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent as unknown as TextLayerParams['textContentSource'],
          container,
          viewport: viewport as unknown as TextLayerParams['viewport'],
        });
        this.inFlightTextTasks.set(container, textLayer);
        try {
          await textLayer.render();
          container.style.width = '100%';
          container.style.height = `${viewport.height}px`;
        } catch (err: unknown) {
          if (
            err &&
            typeof err === 'object' &&
            'name' in err &&
            (err.name === 'AbortException' || err.name === 'RenderingCancelledException')
          ) {
            return;
          }
          throw err;
        } finally {
          if (this.inFlightTextTasks.get(container) === textLayer) {
            this.inFlightTextTasks.delete(container);
          }
        }
        return;
      }
    } catch {
      // In non-browser environments or when native TextLayer fails, gracefully fallback
    }

    if (container && hasDocument()) {
      for (const item of textContent.items) {
        const text = 'str' in item ? item.str : '';
        if (text) {
          const span = document.createElement('span');
          span.textContent = text;
          span.style.position = 'absolute';
          span.style.color = 'transparent';
          container.appendChild(span);
        }
      }
    }
  }

  public cancelPageRender(canvas?: HTMLCanvasElement | null, container?: HTMLElement | null): void {
    if (canvas) {
      const task = this.inFlightCanvasTasks.get(canvas);
      if (task) {
        try {
          task.cancel?.();
        } catch {
          // ignore
        }
        this.inFlightCanvasTasks.delete(canvas);
      }
    }
    if (container) {
      this.abortTextTask(container);
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.documentProxy?.destroy?.();
    this.documentProxy = null;
    this.pages = [];
  }

  public async goToPage(target: number | string): Promise<void> {
    if (this.pages.length === 0) {
      return;
    }

    if (typeof target === 'number') {
      const clampedIndex = Math.max(0, Math.min(this.pages.length - 1, target - 1));
      this.currentPageIndex = clampedIndex;
    } else {
      const pageMatch = target.match(/\d+/);
      const parsedNum = pageMatch ? Number.parseInt(pageMatch[0], 10) : 1;
      const clampedIndex = Math.max(0, Math.min(this.pages.length - 1, parsedNum - 1));
      this.currentPageIndex = clampedIndex;
    }

    this.emitPageChanged();
  }

  public async nextPage(): Promise<void> {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex += 1;
      this.emitPageChanged();
    }
  }

  public async prevPage(): Promise<void> {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex -= 1;
      this.emitPageChanged();
    }
  }

  public getCurrentPage(): PageInfo {
    const totalPages = Math.max(1, this.pages.length);
    const currentPage = Math.max(1, Math.min(totalPages, this.currentPageIndex + 1));
    const page = this.pages[currentPage - 1];
    const percentage = Math.round((currentPage / totalPages) * 100);

    return {
      currentPage,
      totalPages,
      chapterTitle: page?.chapterTitle ?? `Page ${currentPage}`,
      percentage,
    };
  }

  public onPageChanged(callback: (pageInfo: PageInfo) => void): void {
    this.pageChangedListeners.push(callback);
  }

  private emitPageChanged(): void {
    const info = this.getCurrentPage();
    for (const listener of this.pageChangedListeners) {
      listener(info);
    }
  }
}
