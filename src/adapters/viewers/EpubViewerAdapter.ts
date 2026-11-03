import type { PageInfo } from '@domain/types';
import type { DocumentPage } from '@ports/IDocumentViewer';
import type { EpubChapterDescriptor, IEpubViewer } from '@ports/IEpubViewer';

export type { EpubChapterDescriptor };

export class EpubViewerAdapter implements IEpubViewer {
  private container: HTMLElement | null = null;
  private pages: DocumentPage[] = [];
  private currentPageIndex = 0;
  private pageChangedListeners: Array<(pageInfo: PageInfo) => void> = [];

  public async render(container: HTMLElement, fileData: ArrayBuffer | string): Promise<void> {
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
    this.pageChangedListeners = [];
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

  public onPageChanged(callback: (pageInfo: PageInfo) => void): void {
    this.pageChangedListeners.push(callback);
  }

  private parsePages(fileData: ArrayBuffer | string): DocumentPage[] {
    const rawText =
      typeof fileData === 'string'
        ? fileData.trim()
        : new TextDecoder().decode(new Uint8Array(fileData)).trim();

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
    this.container.innerHTML = [
      `<article data-epub-page="${pageNumber}" data-cfi-base="${page.cfiBase}">`,
      `<h2>${page.chapterTitle}</h2>`,
      `<p>${page.paragraphs.join(' ')}</p>`,
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
