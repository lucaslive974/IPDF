import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';
import type { BookFormat } from '../domain/types';

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

export interface ImportLibraryBookInput {
  readonly rawBytes: Uint8Array;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly totalPages: number;
  readonly coverImageUrl?: string;
}

export interface DocumentPage {
  readonly pageNumber: number;
  readonly chapterTitle: string;
  readonly paragraphs: string[];
  readonly cfiBase: string;
}

export interface IBackendGateway {
  listLibraryBooks(): Promise<BookMetadata[]>;
  readBookBinary(bookHash: string): Promise<Uint8Array>;
  getBookPages(bookHash: string, startPage: number, count: number): Promise<DocumentPage[]>;
  importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata>;
  updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number
  ): Promise<BookMetadata>;
  loadBookHighlights(bookHash: string): Promise<Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  buildTermLookupRequest(context: ReadingContext, targetLanguage?: string): Promise<LLMRequest>;
  syncBookWorkspace(bookHash: string): Promise<string>;
}
