import { invoke } from '@tauri-apps/api/core';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type {
  DocumentPage,
  IReaderService,
  LLMRequest,
  ReadingContext,
} from '../../core/ports/IReaderService';
import { type SerializedBookMetadata, deserializeBookMetadata } from './TauriLibraryService';

export class TauriReaderService implements IReaderService {
  public async readBookBinary(bookHash: string): Promise<Uint8Array> {
    const raw = await invoke<ArrayBuffer | Uint8Array | number[]>('read_book_binary', {
      bookHash,
    });
    if (raw instanceof ArrayBuffer) {
      return new Uint8Array(raw);
    }
    if (ArrayBuffer.isView(raw)) {
      return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
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
    totalPages: number
  ): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('update_book_progress', {
      bookHash,
      currentPage,
      totalPages,
    });
    return deserializeBookMetadata(dto);
  }

  public async getBookFilePath(bookHash: string): Promise<string | null> {
    try {
      const path = await invoke<string>('get_book_file_path', { bookHash });
      return path && path.trim().length > 0 ? path : null;
    } catch {
      return null;
    }
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
