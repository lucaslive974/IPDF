import { invoke } from '@tauri-apps/api/core';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { BookFormat } from '../../core/domain/types';
import type { ILibraryService, ImportLibraryBookInput } from '../../core/ports/ILibraryService';

export interface SerializedBookMetadata {
  readonly bookHash: string;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly percentage: number;
  readonly coverImageUrl?: string;
  readonly lastReadAtMs: number;
  readonly updatedAtMs: number;
}

export function deserializeBookMetadata(dto: SerializedBookMetadata): BookMetadata {
  return {
    bookHash: dto.bookHash,
    title: dto.title,
    author: dto.author,
    format: dto.format,
    currentPage: dto.currentPage,
    totalPages: dto.totalPages,
    percentage: dto.percentage,
    coverImageUrl: dto.coverImageUrl,
    lastReadAt: new Date(dto.lastReadAtMs),
    updatedAt: new Date(dto.updatedAtMs),
  };
}

export class TauriLibraryService implements ILibraryService {
  public async listLibraryBooks(): Promise<BookMetadata[]> {
    const dtos = await invoke<SerializedBookMetadata[]>('list_library_books');
    return dtos.map(deserializeBookMetadata);
  }

  public async getStartupBook(): Promise<BookMetadata | null> {
    const dto = await invoke<SerializedBookMetadata | null>('get_startup_book');
    return dto ? deserializeBookMetadata(dto) : null;
  }

  public async openBookFile(filePath: string): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('open_book_file', { filePath });
    return deserializeBookMetadata(dto);
  }

  public async importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('import_library_book', {
      rawBytes: Array.from(input.rawBytes),
      title: input.title,
      author: input.author,
      format: input.format,
      totalPages: input.totalPages,
      coverImageUrl: input.coverImageUrl ?? null,
    });
    return deserializeBookMetadata(dto);
  }

  public async renameBook(bookHash: string, newTitle: string): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('rename_book', {
      bookHash,
      newTitle,
    });
    return deserializeBookMetadata(dto);
  }
}
