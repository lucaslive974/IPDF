import type { Highlight } from '../domain/Highlight';

export interface IHighlightService {
  loadBookHighlights(bookHash: string): Promise<Highlight[]>;
  loadAllHighlights(): Promise<Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
}
