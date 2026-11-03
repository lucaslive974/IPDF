import type { Highlight } from '@domain/Highlight';
import {
  BookFormat,
  type BoundingBox,
  type HighlightAnchor,
  type PageInfo,
  type SentenceNode,
  type TextSelection,
} from '@domain/types';
import type { DocumentPage } from '@ports/IDocumentViewer';
import type { IPdfEngine, PdfDocumentProxy, PdfPageProxy } from '@ports/IPdfEngine';
import type { IPdfViewer } from '@ports/IPdfViewer';
import { DefaultPdfEngine } from './DefaultPdfEngine';

interface InlineAnnotationEntry {
  readonly anchor: HighlightAnchor;
  readonly shortText: string;
  readonly tooltipDetails?: string;
}

const createDefaultClientRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 120,
    height: 20,
    top: 0,
    right: 120,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

export class PdfViewerAdapter implements IPdfViewer {
  private container: HTMLElement | null = null;
  private readonly engine: IPdfEngine;
  private documentProxy: PdfDocumentProxy | null = null;
  private pages: DocumentPage[] = [];
  private currentPageIndex = 0;
  private readonly renderedHighlights = new Map<string, Highlight>();
  private readonly inlineAnnotations: InlineAnnotationEntry[] = [];
  private activeTtsSentenceId: string | null = null;
  private currentSelection: TextSelection | null = null;

  private readonly pageChangedListeners: Array<(pageInfo: PageInfo) => void> = [];
  private readonly textSelectedListeners: Array<(selection: TextSelection | null) => void> = [];
  private readonly highlightClickedListeners: Array<(highlight: Highlight, rect: DOMRect) => void> =
    [];

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
      paragraphs: [],
      cfiBase: `page-${idx + 1}`,
    }));

    // Extract initial page chunk (up to 5 pages) so reader immediately has content
    const initialCount = Math.min(5, total);
    await this.ensurePagesExtracted(1, initialCount);

    this.currentPageIndex = 0;
    this.emitPageChanged();
  }

  private async extractPageParagraphs(pageNumber: number): Promise<string[]> {
    if (!this.documentProxy) return [];
    try {
      const pageProxy = await this.documentProxy.getPage(pageNumber);
      const textContent = await pageProxy.getTextContent();
      const rawParagraphs: string[] = [];
      let currentParagraph = '';

      for (const item of textContent.items) {
        const text = 'str' in item ? item.str : '';
        if (!text || text.trim() === '') {
          if (currentParagraph.trim().length > 0) {
            rawParagraphs.push(currentParagraph.trim());
            currentParagraph = '';
          }
        } else {
          currentParagraph += (currentParagraph.length > 0 ? ' ' : '') + text.trim();
        }
      }
      if (currentParagraph.trim().length > 0) {
        rawParagraphs.push(currentParagraph.trim());
      }

      return rawParagraphs.length > 0 ? rawParagraphs : [`[Page ${pageNumber}]`];
    } catch {
      return [`[Page ${pageNumber}]`];
    }
  }

  public async ensurePagesExtracted(startPage: number, count: number): Promise<DocumentPage[]> {
    if (!this.documentProxy || this.pages.length === 0) return [];
    const end = Math.min(this.pages.length, startPage + count - 1);
    for (let i = Math.max(1, startPage); i <= end; i++) {
      const current = this.pages[i - 1];
      if (current && current.paragraphs.length > 0 && current.paragraphs[0] !== `[Page ${i}]`) {
        continue;
      }
      const paragraphs = await this.extractPageParagraphs(i);
      this.pages[i - 1] = {
        pageNumber: i,
        chapterTitle: `Page ${i}`,
        paragraphs,
        cfiBase: `page-${i}`,
      };
    }
    return this.getPagesChunk(startPage, count);
  }

  public setPages(pages: DocumentPage[]): void {
    this.pages = pages;
    this.emitPageChanged();
  }

  public getPage(pageNumber: number): DocumentPage | null {
    if (pageNumber < 1 || pageNumber > this.pages.length) {
      return null;
    }
    const page = this.pages[pageNumber - 1];
    if (!page) return null;
    if (page.paragraphs.length === 0) {
      return {
        ...page,
        paragraphs: [`[Page ${pageNumber}]`],
      };
    }
    return page;
  }

  public getPagesChunk(startPage: number, count: number): DocumentPage[] {
    const startIndex = Math.max(0, startPage - 1);
    return this.pages.slice(startIndex, startIndex + count).map((p) => {
      if (p.paragraphs.length === 0) {
        return {
          ...p,
          paragraphs: [`[Page ${p.pageNumber}]`],
        };
      }
      return p;
    });
  }

  public getParagraphsForChapter(index = this.currentPageIndex): string[] {
    const page = this.pages[index];
    if (!page) return [];
    if (page.paragraphs.length === 0) {
      return [`[Page ${page.pageNumber}]`];
    }
    return page.paragraphs;
  }

  public async getPageProxy(pageNumber: number): Promise<PdfPageProxy | null> {
    if (!this.documentProxy || pageNumber < 1 || pageNumber > this.documentProxy.numPages) {
      return null;
    }
    return this.documentProxy.getPage(pageNumber);
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

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const scale = targetScale * dpr;
    const viewport = pageProxy.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (context && pageProxy.render) {
      const task = pageProxy.render({
        canvasContext: context,
        viewport,
      });
      await task.promise;
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

    if (container) {
      container.innerHTML = '';
      if (container.style) {
        container.style.setProperty('--scale-factor', `${targetScale}`);
        container.style.setProperty('--total-scale-factor', `${targetScale}`);
        container.style.setProperty('--user-unit', '1');
        container.style.setProperty('--scale-round-x', '1px');
        container.style.setProperty('--scale-round-y', '1px');
      }
    }

    const viewport = pageProxy.getViewport({ scale: targetScale });
    const textContent = await pageProxy.getTextContent();

    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.TextLayer && typeof window !== 'undefined' && typeof document !== 'undefined') {
        type TextLayerParams = ConstructorParameters<typeof pdfjsLib.TextLayer>[0];
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent as unknown as TextLayerParams['textContentSource'],
          container,
          viewport: viewport as unknown as TextLayerParams['viewport'],
        });
        await textLayer.render();
        return;
      }
    } catch {
      // In non-browser environments or when native TextLayer fails, gracefully fallback
    }

    if (container && typeof document !== 'undefined') {
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

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.documentProxy?.destroy?.();
    this.documentProxy = null;
    this.pages = [];
    this.renderedHighlights.clear();
    this.inlineAnnotations.length = 0;
    this.activeTtsSentenceId = null;
    this.currentSelection = null;
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

  public getSelection(): TextSelection | null {
    return this.currentSelection;
  }

  public clearSelection(): void {
    this.currentSelection = null;
    for (const listener of this.textSelectedListeners) {
      listener(null);
    }
  }

  public simulateTextSelection(selectedText: string, rects?: BoundingBox[]): void {
    const page = this.pages[this.currentPageIndex];
    const pageNumber = this.currentPageIndex + 1;

    const selection: TextSelection = {
      text: selectedText,
      surroundingContext: page?.paragraphs.join(' ') ?? selectedText,
      anchor: {
        format: BookFormat.PDF,
        pageNumber,
        pdfRects: rects ?? [{ x: 0.1, y: 0.2, width: 0.8, height: 0.05 }],
      },
      clientRect: createDefaultClientRect(),
    };

    this.currentSelection = selection;
    for (const listener of this.textSelectedListeners) {
      listener(selection);
    }
  }

  public renderHighlights(highlights: Highlight[]): void {
    this.renderedHighlights.clear();
    for (const hl of highlights) {
      this.renderedHighlights.set(hl.id, hl);
    }
  }

  public eraseHighlightFromDOM(highlightId: string): void {
    this.renderedHighlights.delete(highlightId);
  }

  public getHighlightsForPage(pageNumber: number): Highlight[] {
    return Array.from(this.renderedHighlights.values()).filter(
      (hl) => hl.anchor.pageNumber === pageNumber
    );
  }

  public triggerHighlightClick(highlightId: string, rect?: DOMRect): void {
    const highlight = this.renderedHighlights.get(highlightId);
    if (!highlight) {
      return;
    }
    const clientRect = rect ?? createDefaultClientRect();
    for (const listener of this.highlightClickedListeners) {
      listener(highlight, clientRect);
    }
  }

  public injectInlineAnnotation(
    anchor: HighlightAnchor,
    shortText: string,
    tooltipDetails?: string
  ): void {
    this.inlineAnnotations.push({ anchor, shortText, tooltipDetails });
  }

  public async extractVisibleSentences(): Promise<SentenceNode[]> {
    const pageNum = this.currentPageIndex + 1;
    let page = this.pages[this.currentPageIndex];
    if (page && (page.paragraphs.length === 0 || page.paragraphs[0] === `[Page ${pageNum}]`)) {
      if (this.documentProxy) {
        await this.ensurePagesExtracted(pageNum, 1);
        page = this.pages[this.currentPageIndex];
      }
    }
    if (!page || page.paragraphs.length === 0) {
      return [];
    }

    const textContent = page.paragraphs.join(' ');
    const parts = textContent
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return parts.map((sentenceText, idx) => ({
      id: `pdf-sentence-p${page.pageNumber}-${idx + 1}`,
      text: sentenceText,
      anchor: {
        format: BookFormat.PDF,
        pageNumber: page.pageNumber,
        pdfRects: [],
      },
    }));
  }

  public setActiveTTSSentence(sentenceId: string | null): void {
    this.activeTtsSentenceId = sentenceId;
  }

  public getActiveTTSSentenceId(): string | null {
    return this.activeTtsSentenceId;
  }

  public onPageChanged(callback: (pageInfo: PageInfo) => void): void {
    this.pageChangedListeners.push(callback);
  }

  public onTextSelected(callback: (selection: TextSelection | null) => void): void {
    this.textSelectedListeners.push(callback);
  }

  public onHighlightClicked(callback: (highlight: Highlight, rect: DOMRect) => void): void {
    this.highlightClickedListeners.push(callback);
  }

  private emitPageChanged(): void {
    const info = this.getCurrentPage();
    for (const listener of this.pageChangedListeners) {
      listener(info);
    }
  }
}
