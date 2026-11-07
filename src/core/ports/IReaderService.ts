import type { BookMetadata } from '../domain/BookMetadata';

export interface DocumentPage {
  readonly pageNumber: number;
  readonly chapterTitle: string;
  readonly paragraphs: string[];
  readonly cfiBase: string;
}

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

export interface IReaderService {
  readBookBinary(bookHash: string): Promise<Uint8Array>;
  getBookPages(bookHash: string, startPage: number, count: number): Promise<DocumentPage[]>;
  updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number,
    pageOffsetRatio?: number
  ): Promise<BookMetadata>;
  getBookFilePath(bookHash: string): Promise<string | null>;
  buildTermLookupRequest(context: ReadingContext, targetLanguage?: string): Promise<LLMRequest>;
}
