import type { Highlight } from '../domain/Highlight';

export interface ReadingContext {
  readonly bookTitle: string;
  readonly bookAuthor?: string;
  readonly chapterTitle?: string;
  readonly selectedText: string;
  readonly surroundingContext: string;
}

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature: number;
  readonly maxTokens: number;
}

export interface IBackendGateway {
  loadBookHighlights(bookHash: string): Promise<Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  buildTermLookupRequest(context: ReadingContext, targetLanguage?: string): Promise<LLMRequest>;
  syncBookWorkspace(bookHash: string): Promise<string>;
}
