import type { BookMetadata } from '@domain/BookMetadata';
import type {
  DocumentPage,
  IReaderService,
  LLMRequest,
  ReadingContext,
} from '@ports/IReaderService';
import { invoke } from '@tauri-apps/api/core';
import { deserializeBookMetadata, type SerializedBookMetadata } from './TauriLibraryService';

export class TauriReaderService implements IReaderService {
  public async readBookBinary(bookHash: string): Promise<Uint8Array> {
    const raw = await invoke<ArrayBuffer>('read_book_binary', { bookHash });
    return new Uint8Array(raw);
  }

  public async getBookPages(
    bookHash: string,
    startPage: number,
    count: number
  ): Promise<DocumentPage[]> {
    return invoke<DocumentPage[]>('get_book_pages', {
      bookHash,
      startPage,
      count,
    });
  }

  public async updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number,
    pageOffsetRatio = 0.0
  ): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('update_book_progress', {
      payload: {
        bookHash,
        currentPage,
        totalPages,
        pageOffsetRatio,
      },
    });
    return deserializeBookMetadata(dto);
  }

  public async getBookFileSize(bookHash: string): Promise<number> {
    return invoke<number>('get_book_file_size', { bookHash });
  }

  public async readBookRange(bookHash: string, begin: number, end: number): Promise<Uint8Array> {
    const raw = await invoke<ArrayBuffer>('read_book_range', { bookHash, begin, end });
    return new Uint8Array(raw);
  }

  public async buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage = 'en'
  ): Promise<LLMRequest> {
    return invoke<LLMRequest>('build_term_lookup_prompt', {
      bookTitle: context.bookTitle,
      bookAuthor: context.bookAuthor ?? null,
      chapterTitle: context.chapterTitle ?? null,
      selectedText: context.selectedText,
      surroundingContext: context.surroundingContext,
      targetLanguage,
    });
  }
}
