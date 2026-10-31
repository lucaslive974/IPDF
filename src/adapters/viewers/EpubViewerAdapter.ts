import type { Highlight } from '../../core/domain/Highlight';
import type {
  HighlightAnchor,
  PageInfo,
  SentenceNode,
  TextSelection,
} from '../../core/domain/types';
import type { IDocumentViewer } from '../../core/ports/IDocumentViewer';

export interface EpubChapterDescriptor {
  readonly title: string;
  readonly cfiBase: string;
  readonly content: string;
}

export interface ExtractedCoverImage {
  readonly coverImageBuffer: Uint8Array;
  readonly coverMimeType: 'image/webp' | 'image/png' | 'image/jpeg';
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
  private chapters: EpubChapterDescriptor[] = [];
  private currentPageIndex = 0;
  private renderedHighlights = new Map<string, Highlight>();
  private inlineAnnotations: InlineAnnotationEntry[] = [];
  private activeTtsSentenceId: string | null = null;
  private currentSelection: TextSelection | null = null;

  private pageChangedListeners: Array<(pageInfo: PageInfo) => void> = [];
  private textSelectedListeners: Array<(selection: TextSelection | null) => void> = [];
  private highlightClickedListeners: Array<(highlight: Highlight, rect: DOMRect) => void> = [];

  public static async extractCoverToUint8Array(
    fileData: ArrayBuffer
  ): Promise<ExtractedCoverImage | null> {
    const bytes = new Uint8Array(fileData);

    // 1. Check PNG signature: 89 50 4E 47 0D 0A 1A 0A ... IEND (49 45 4E 44 AE 42 60 82)
    for (let i = 0; i <= bytes.length - 8; i += 1) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47
      ) {
        let endIdx = bytes.length;
        for (let j = i + 8; j <= bytes.length - 8; j += 1) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            endIdx = Math.min(bytes.length, j + 8);
            break;
          }
        }
        return {
          coverImageBuffer: bytes.slice(i, endIdx),
          coverMimeType: 'image/png',
        };
      }
    }

    // 2. Check JPEG signature: FF D8 FF ... FF D9
    for (let i = 0; i <= bytes.length - 4; i += 1) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        let endIdx = bytes.length;
        for (let j = i + 3; j <= bytes.length - 2; j += 1) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            endIdx = j + 2;
            break;
          }
        }
        return {
          coverImageBuffer: bytes.slice(i, endIdx),
          coverMimeType: 'image/jpeg',
        };
      }
    }

    // 3. Check WEBP signature: "RIFF" .... "WEBP"
    for (let i = 0; i <= bytes.length - 12; i += 1) {
      if (
        bytes[i] === 0x52 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0x46 &&
        bytes[i + 3] === 0x46 &&
        bytes[i + 8] === 0x57 &&
        bytes[i + 9] === 0x45 &&
        bytes[i + 10] === 0x42 &&
        bytes[i + 11] === 0x50
      ) {
        return {
          coverImageBuffer: bytes.slice(i),
          coverMimeType: 'image/webp',
        };
      }
    }

    return null;
  }

  public async render(container: HTMLElement, fileData: ArrayBuffer): Promise<void> {
    this.container = container;
    this.chapters = this.parseEpubChapters(fileData);
    this.currentPageIndex = 0;
    this.flushDom();
    this.emitPageChanged();
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.chapters = [];
    this.renderedHighlights.clear();
    this.inlineAnnotations = [];
    this.activeTtsSentenceId = null;
    this.currentSelection = null;
  }

  public async goToPage(target: number | string): Promise<void> {
    if (this.chapters.length === 0) {
      return;
    }

    if (typeof target === 'number') {
      const clampedIndex = Math.max(0, Math.min(this.chapters.length - 1, target - 1));
      this.currentPageIndex = clampedIndex;
    } else {
      const foundIndex = this.chapters.findIndex((ch) => target.startsWith(ch.cfiBase));
      if (foundIndex >= 0) {
        this.currentPageIndex = foundIndex;
      }
    }

    this.flushDom();
    this.emitPageChanged();
  }

  public async nextPage(): Promise<void> {
    if (this.currentPageIndex < this.chapters.length - 1) {
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
    const totalPages = Math.max(1, this.chapters.length);
    const currentPage = this.currentPageIndex + 1;
    const chapter = this.chapters[this.currentPageIndex];
    const percentage = Math.round((currentPage / totalPages) * 100);

    return {
      currentPage,
      totalPages,
      chapterTitle: chapter?.title,
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
    const chapter = this.chapters[this.currentPageIndex];
    const pageNumber = this.currentPageIndex + 1;
    const cfi = epubCfi ?? `${chapter?.cfiBase ?? 'epubcfi(/6/2!/4/2'}/1:0)`;

    const selection: TextSelection = {
      text: selectedText,
      surroundingContext: chapter?.content ?? selectedText,
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
    const chapter = this.chapters[this.currentPageIndex];
    if (!chapter) {
      return [];
    }

    const pageNumber = this.currentPageIndex + 1;
    const parts = chapter.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let charOffset = 0;
    return parts.map((sentenceText, idx) => {
      const cfi = `${chapter.cfiBase}/1:${charOffset})`;
      charOffset += sentenceText.length + 1;
      return {
        id: `epub-sentence-p${pageNumber}-${idx + 1}`,
        text: sentenceText,
        anchor: {
          format: 'epub',
          pageNumber,
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

  private parseEpubChapters(fileData: ArrayBuffer): EpubChapterDescriptor[] {
    const rawText = new TextDecoder().decode(new Uint8Array(fileData)).trim();
    if (rawText.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawText) as { chapters?: EpubChapterDescriptor[] };
        if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          return parsed.chapters;
        }
      } catch {
        // Fallback to single chapter text below
      }
    }

    return [
      {
        title: 'Chapter 1',
        cfiBase: 'epubcfi(/6/2!/4/2',
        content: rawText.length > 0 ? rawText : 'Empty EPUB Document',
      },
    ];
  }

  private flushDom(): void {
    if (!this.container) {
      return;
    }

    const chapter = this.chapters[this.currentPageIndex];
    if (!chapter) {
      this.container.innerHTML = '';
      return;
    }

    const pageNumber = this.currentPageIndex + 1;
    const highlightMarks: string[] = [];
    for (const hl of this.renderedHighlights.values()) {
      if (hl.anchor.pageNumber === pageNumber) {
        const cfi = hl.anchor.epubCfi ?? `${chapter.cfiBase}/1:0)`;
        highlightMarks.push(
          `<mark data-highlight-id="${hl.id}" data-epub-cfi="${cfi}" style="background-color:${hl.color}">${hl.text}</mark>`
        );
      }
    }

    const rubyNodes: string[] = [];
    for (const inline of this.inlineAnnotations) {
      if (inline.anchor.pageNumber === pageNumber) {
        const cfi = inline.anchor.epubCfi ?? `${chapter.cfiBase}/1:0)`;
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
      `<article data-epub-page="${pageNumber}" data-cfi-base="${chapter.cfiBase}"${ttsAttr}>`,
      `<h2>${chapter.title}</h2>`,
      `<p>${chapter.content}</p>`,
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
