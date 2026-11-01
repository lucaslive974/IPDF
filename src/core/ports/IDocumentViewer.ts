import type { Highlight } from '../domain/Highlight';
import type { HighlightAnchor, PageInfo, SentenceNode, TextSelection } from '../domain/types';
import type { DocumentPage } from './IReaderService';

export type { DocumentPage };

export interface IDocumentViewer {
  render(container: HTMLElement, fileData: ArrayBuffer): Promise<void>;
  destroy(): void;

  goToPage(target: number | string): Promise<void>;
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  getCurrentPage(): PageInfo;
  getParagraphsForChapter(index?: number): string[];

  getPage(pageNumber: number): DocumentPage | null;
  getPagesChunk(startPage: number, count: number): DocumentPage[];
  setPages(pages: DocumentPage[]): void;

  getSelection(): TextSelection | null;
  clearSelection(): void;
  renderHighlights(highlights: Highlight[]): void;
  eraseHighlightFromDOM(highlightId: string): void;
  injectInlineAnnotation(anchor: HighlightAnchor, shortText: string, tooltipDetails?: string): void;

  extractVisibleSentences(): Promise<SentenceNode[]>;
  setActiveTTSSentence(sentenceId: string | null): void;

  onPageChanged(callback: (pageInfo: PageInfo) => void): void;
  onTextSelected(callback: (selection: TextSelection | null) => void): void;
  onHighlightClicked(callback: (highlight: Highlight, rect: DOMRect) => void): void;
}
