import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';

export interface IRepository<T, ID = string> {
  save(entity: T): Promise<void>;
  findById(id: ID): Promise<T | null>;
  update(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface IBookRepository extends IRepository<BookMetadata, string> {
  findAll(): Promise<BookMetadata[]>;
}

export interface IHighlightRepository extends IRepository<Highlight, string> {
  findByBook(bookHash: string): Promise<Highlight[]>;
  findByBookAndPage(bookHash: string, pageNumber: number): Promise<Highlight[]>;
  searchByTextOrNote(bookHash: string, query: string): Promise<Highlight[]>;
}
