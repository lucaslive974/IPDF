import type { BookMetadata } from '@domain/BookMetadata';
import type { BookFormat } from '@domain/types';
import type {
  ILibraryService,
  ImportLibraryBookInput,
  UpdateBookMetadataInput,
} from '@ports/ILibraryService';
import { invoke } from '@tauri-apps/api/core';

export interface SerializedBookMetadata {
  readonly bookHash: string;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly percentage: number;
  readonly pageOffsetRatio?: number;
  readonly description?: string;
  readonly tags?: string[];
  readonly lastReadAtMs: number;
  readonly updatedAtMs: number;
}

export function deserializeBookMetadata(dto: SerializedBookMetadata): BookMetadata {
  const authorTrimmed = dto.author?.trim() ?? '';
  const author = authorTrimmed.toLowerCase() === 'local file' ? 'Unknown' : dto.author;
  return {
    bookHash: dto.bookHash,
    title: dto.title,
    author,
    format: dto.format,
    currentPage: dto.currentPage,
    totalPages: dto.totalPages,
    percentage: dto.percentage,
    pageOffsetRatio: dto.pageOffsetRatio ?? 0.0,
    description: dto.description ?? undefined,
    tags: dto.tags ?? [],
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

  public async importBooksFromPaths(filePaths: readonly string[]): Promise<BookMetadata[]> {
    const dtos = await invoke<SerializedBookMetadata[]>('import_books_from_paths', {
      filePaths: Array.from(filePaths),
    });
    return dtos.map(deserializeBookMetadata);
  }

  public async importBookFromPath(filePath: string): Promise<BookMetadata> {
    const [book] = await this.importBooksFromPaths([filePath]);
    if (!book) {
      throw new Error(`Failed to import book file: ${filePath}`);
    }
    return book;
  }

  public async pickAndImportBook(): Promise<BookMetadata | null> {
    const dto = await invoke<SerializedBookMetadata | null>('pick_and_import_book');
    return dto ? deserializeBookMetadata(dto) : null;
  }

  public async importBookFromBytes(input: ImportLibraryBookInput): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('import_book_from_bytes', {
      rawBytes: Array.from(input.rawBytes),
      title: input.title,
      author: input.author,
      format: input.format,
      totalPages: input.totalPages,
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

  public async updateBookMetadata(
    bookHash: string,
    input: UpdateBookMetadataInput
  ): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('update_book_metadata', {
      bookHash,
      title: input.title,
      author: input.author,
      tags: Array.from(input.tags),
      description: input.description ?? null,
    });
    return deserializeBookMetadata(dto);
  }

  public async listAuthors(): Promise<string[]> {
    return invoke<string[]>('list_authors');
  }

  public async listTags(): Promise<string[]> {
    return invoke<string[]>('list_tags');
  }

  public async deleteBook(bookHash: string): Promise<boolean> {
    return invoke<boolean>('delete_book', { bookHash });
  }

  public async saveBookCover(bookHash: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    await invoke<void>('save_book_cover', bytes, {
      headers: {
        'x-book-hash': bookHash,
        'x-mime-type': mimeType,
      },
    });
  }

  public async deleteBookCover(bookHash: string): Promise<void> {
    await invoke<void>('delete_book_cover', { bookHash });
  }
}
