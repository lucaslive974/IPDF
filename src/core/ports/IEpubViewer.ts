import type { DocumentPage, IDocumentViewer } from './IDocumentViewer';

export interface EpubChapterDescriptor {
  readonly title: string;
  readonly cfiBase: string;
  readonly content: string;
}

/**
 * Specialized EPUB document viewer port.
 * Extends IDocumentViewer with reflowable chapter structures and paragraph access.
 */
export interface IEpubViewer extends IDocumentViewer {
  getChapters(): EpubChapterDescriptor[];
  getParagraphsForChapter(index?: number): string[];
}
