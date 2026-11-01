import type { Highlight } from '../../core/domain/Highlight';
import type {
  HighlightAnchor,
  PageInfo,
  SentenceNode,
  TextSelection,
} from '../../core/domain/types';
import type { DocumentPage, IDocumentViewer } from '../../core/ports/IDocumentViewer';

export interface EpubChapterDescriptor {
  readonly title: string;
  readonly cfiBase: string;
  readonly content: string;
}

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

export class EpubViewerAdapter implements IDocumentViewer {
  private container: HTMLElement | null = null;
  private pages: DocumentPage[] = [];
  private currentPageIndex = 0;
  private renderedHighlights = new Map<string, Highlight>();
  private inlineAnnotations: InlineAnnotationEntry[] = [];
  private activeTtsSentenceId: string | null = null;
  private currentSelection: TextSelection | null = null;

  private pageChangedListeners: Array<(pageInfo: PageInfo) => void> = [];
  private textSelectedListeners: Array<(selection: TextSelection | null) => void> = [];
  private highlightClickedListeners: Array<(highlight: Highlight, rect: DOMRect) => void> = [];

  public async render(container: HTMLElement, fileData: ArrayBuffer): Promise<void> {
    this.container = container;
    this.pages = this.parsePages(fileData);
    this.currentPageIndex = 0;
    this.flushDom();
    this.emitPageChanged();
  }

  public setPages(pages: DocumentPage[]): void {
    this.pages = pages;
    this.flushDom();
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

  public getChapters(): EpubChapterDescriptor[] {
    return this.pages.map((p) => ({
      title: p.chapterTitle,
      cfiBase: p.cfiBase,
      content: p.paragraphs.join('\n\n'),
    }));
  }

  public getParagraphsForChapter(index = this.currentPageIndex): string[] {
    return this.pages[index]?.paragraphs ?? [];
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.pages = [];
    this.renderedHighlights.clear();
    this.inlineAnnotations = [];
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
      const foundIndex = this.pages.findIndex((p) => target.startsWith(p.cfiBase));
      if (foundIndex >= 0) {
        this.currentPageIndex = foundIndex;
      }
    }

    this.flushDom();
    this.emitPageChanged();
  }

  public async nextPage(): Promise<void> {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex += 1;
      this.flushDom();
      this.emitPageChanged();
    }
  }

  public async prevPage(): Promise<void> {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex -= 1;
      this.flushDom();
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
      chapterTitle: page?.chapterTitle ?? 'Chapter 1',
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

  public simulateTextSelection(selectedText: string, epubCfi?: string): void {
    const page = this.pages[this.currentPageIndex];
    const pageNumber = this.currentPageIndex + 1;
    const cfi = epubCfi ?? `${page?.cfiBase ?? 'epubcfi(/6/2!/4/2'}/1:0)`;

    const selection: TextSelection = {
      text: selectedText,
      surroundingContext: page?.paragraphs.join(' ') ?? selectedText,
      anchor: {
        format: 'epub',
        pageNumber,
        epubCfi: cfi,
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
    this.flushDom();
  }

  public eraseHighlightFromDOM(highlightId: string): void {
    this.renderedHighlights.delete(highlightId);
    this.flushDom();
  }

  public triggerHighlightClick(highlightId: string): void {
    const highlight = this.renderedHighlights.get(highlightId);
    if (!highlight) {
      return;
    }
    const rect = createDefaultClientRect();
    for (const listener of this.highlightClickedListeners) {
      listener(highlight, rect);
    }
  }

  public injectInlineAnnotation(
    anchor: HighlightAnchor,
    shortText: string,
    tooltipDetails?: string
  ): void {
    this.inlineAnnotations.push({ anchor, shortText, tooltipDetails });
    this.flushDom();
  }

  public async extractVisibleSentences(): Promise<SentenceNode[]> {
    const page = this.pages[this.currentPageIndex];
    if (!page || page.paragraphs.length === 0) {
      return [];
    }

    const textContent = page.paragraphs.join(' ');
    const parts = textContent
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let charOffset = 0;
    return parts.map((sentenceText, idx) => {
      const cfi = `${page.cfiBase}/1:${charOffset})`;
      charOffset += sentenceText.length + 1;
      return {
        id: `epub-sentence-p${page.pageNumber}-${idx + 1}`,
        text: sentenceText,
        anchor: {
          format: 'epub',
          pageNumber: page.pageNumber,
          epubCfi: cfi,
        },
      };
    });
  }

  public setActiveTTSSentence(sentenceId: string | null): void {
    this.activeTtsSentenceId = sentenceId;
    this.flushDom();
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

  private parsePages(fileData: ArrayBuffer): DocumentPage[] {
    const rawText = new TextDecoder().decode(new Uint8Array(fileData)).trim();

    if (rawText.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawText) as {
          chapters?: Array<{ title: string; cfiBase: string; content: string }>;
        };
        if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          return parsed.chapters.map((ch, idx) => ({
            pageNumber: idx + 1,
            chapterTitle: ch.title,
            paragraphs: ch.content
              .split(/(?:<\/p>|\n\s*\n)/i)
              .map((p) => p.replace(/<[^>]+>/g, '').trim())
              .filter((p) => p.length > 0),
            cfiBase: `${ch.cfiBase}/1:0`,
          }));
        }
      } catch {
        // Fallback to plain text
      }
    }

    const content = rawText.length > 0 ? rawText : 'Empty EPUB Document';
    return [
      {
        pageNumber: 1,
        chapterTitle: 'Chapter 1',
        paragraphs: content
          .split(/\n\s*\n/)
          .map((p) => p.replace(/<[^>]+>/g, '').trim())
          .filter((p) => p.length > 0),
        cfiBase: 'epubcfi(/6/2!/4/2/1:0)',
      },
    ];
  }

  private flushDom(): void {
    if (!this.container) {
      return;
    }

    const page = this.pages[this.currentPageIndex];
    if (!page) {
      this.container.innerHTML = '';
      return;
    }

    const pageNumber = this.currentPageIndex + 1;
    const highlightMarks: string[] = [];
    for (const hl of this.renderedHighlights.values()) {
      if (hl.anchor.pageNumber === pageNumber) {
        const cfi = hl.anchor.epubCfi ?? `${page.cfiBase}/1:0)`;
        highlightMarks.push(
          `<mark data-highlight-id="${hl.id}" data-epub-cfi="${cfi}" style="background-color:${hl.color}">${hl.text}</mark>`
        );
      }
    }

    const rubyNodes: string[] = [];
    for (const inline of this.inlineAnnotations) {
      if (inline.anchor.pageNumber === pageNumber) {
        const cfi = inline.anchor.epubCfi ?? `${page.cfiBase}/1:0)`;
        const detail = inline.tooltipDetails ?? inline.shortText;
        rubyNodes.push(
          `<ruby data-inline-cfi="${cfi}">${inline.shortText}<rt>${detail}</rt></ruby>`
        );
      }
    }

    const ttsAttr = this.activeTtsSentenceId
      ? ` data-tts-active="${this.activeTtsSentenceId}"`
      : '';

    this.container.innerHTML = [
      `<article data-epub-page="${pageNumber}" data-cfi-base="${page.cfiBase}"${ttsAttr}>`,
      `<h2>${page.chapterTitle}</h2>`,
      `<p>${page.paragraphs.join(' ')}</p>`,
      ...highlightMarks,
      ...rubyNodes,
      '</article>',
    ].join('');
  }

  private emitPageChanged(): void {
    const info = this.getCurrentPage();
    for (const listener of this.pageChangedListeners) {
      listener(info);
    }
  }
}
