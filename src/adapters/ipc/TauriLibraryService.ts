import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { BookFormat } from '../../core/domain/types';
import type {
  ILibraryService,
  ImportLibraryBookInput,
  UpdateBookMetadataInput,
} from '../../core/ports/ILibraryService';

export interface SerializedBookMetadata {
  readonly bookHash: string;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly percentage: number;
  readonly coverImageUrl?: string;
  readonly description?: string;
  readonly tags?: string[];
  readonly lastReadAtMs: number;
  readonly updatedAtMs: number;
}

export function resolveCoverUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('asset:')
  ) {
    return trimmed;
  }
  try {
    return convertFileSrc(trimmed);
  } catch {
    return trimmed;
  }
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
    coverImageUrl: resolveCoverUrl(dto.coverImageUrl),
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
}
