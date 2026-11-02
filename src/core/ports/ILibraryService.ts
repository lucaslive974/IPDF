import type { BookMetadata } from '../domain/BookMetadata';
import type { BookFormat } from '../domain/types';

export interface ImportLibraryBookInput {
  readonly rawBytes: Uint8Array;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly totalPages: number;
  readonly coverImageUrl?: string;
}

export interface UpdateBookMetadataInput {
  readonly title: string;
  readonly author: string;
  readonly tags: readonly string[];
  readonly description?: string;
}

export interface ILibraryService {
  listLibraryBooks(): Promise<BookMetadata[]>;
  getStartupBook(): Promise<BookMetadata | null>;
  openBookFile(filePath: string): Promise<BookMetadata>;
  importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata>;
  renameBook(bookHash: string, newTitle: string): Promise<BookMetadata>;
  updateBookMetadata(bookHash: string, input: UpdateBookMetadataInput): Promise<BookMetadata>;
  listAuthors(): Promise<string[]>;
  listTags(): Promise<string[]>;
  deleteBook(bookHash: string): Promise<boolean>;
  pickAndImportBook?(): Promise<BookMetadata | null>;
  updateBookCover?(bookHash: string, coverImageUrl: string): Promise<BookMetadata>;
}
