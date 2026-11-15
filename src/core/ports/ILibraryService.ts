import type { BookMetadata } from '../domain/BookMetadata';
import type { BookFormat } from '../domain/types';

export interface ImportLibraryBookInput {
  readonly rawBytes: Uint8Array;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly totalPages: number;
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
  importBookFromPath(filePath: string): Promise<BookMetadata>;
  importBooksFromPaths?(filePaths: readonly string[]): Promise<BookMetadata[]>;
  importBookFromBytes(input: ImportLibraryBookInput): Promise<BookMetadata>;
  renameBook(bookHash: string, newTitle: string): Promise<BookMetadata>;
  updateBookMetadata(bookHash: string, input: UpdateBookMetadataInput): Promise<BookMetadata>;
  listAuthors(): Promise<string[]>;
  listTags(): Promise<string[]>;
  deleteBook(bookHash: string): Promise<boolean>;
  saveBookCover(bookHash: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  deleteBookCover(bookHash: string): Promise<void>;
  pickAndImportBook?(): Promise<BookMetadata | null>;
}
