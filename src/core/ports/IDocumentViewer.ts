import type { PageInfo } from '../domain/types';
import type { DocumentPage } from './IReaderService';

export type { DocumentPage };

/**
 * Base document viewer port.
 * Exposes core document lifecycle, navigation, page chunking, and change events.
 */
export interface IDocumentViewer<TSource = ArrayBuffer> {
  render(container: HTMLElement, fileData: TSource): Promise<void>;
  destroy(): void;

  goToPage(target: number | string): Promise<void>;
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  getCurrentPage(): PageInfo;

  getPage(pageNumber: number): DocumentPage | null;
  getPagesChunk(startPage: number, count: number): DocumentPage[];
  setPages(pages: DocumentPage[]): void;

  onPageChanged(callback: (pageInfo: PageInfo) => void): void;
}
