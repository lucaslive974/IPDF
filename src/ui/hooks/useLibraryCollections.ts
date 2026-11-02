import { isValidAuthor } from '@components/library/BookCover';
import type { BookMetadata } from '@domain/BookMetadata';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useMemo } from 'react';
import { useNavigation } from './useNavigation';

export function groupBooksByTag(books: readonly BookMetadata[]): Array<[string, BookMetadata[]]> {
  const map = new Map<string, BookMetadata[]>();
  for (const book of books) {
    if (book.tags) {
      for (const tag of book.tags) {
        const trimmed = tag.trim();
        if (trimmed) {
          const list = map.get(trimmed) ?? [];
          list.push(book);
          map.set(trimmed, list);
        }
      }
    }
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function groupBooksByAuthor(
  books: readonly BookMetadata[]
): Array<[string, BookMetadata[]]> {
  const map = new Map<string, BookMetadata[]>();
  for (const book of books) {
    if (isValidAuthor(book.author)) {
      const trimmed = book.author.trim();
      const list = map.get(trimmed) ?? [];
      list.push(book);
      map.set(trimmed, list);
    }
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export interface UseLibraryCollectionsOptions {
  readonly books?: readonly BookMetadata[];
  readonly onOpenBook?: (book: BookMetadata) => void;
}

export interface LibraryCollectionsViewModel {
  readonly collectionsByTag: readonly (readonly [string, readonly BookMetadata[]])[];
  readonly collectionsByAuthor: readonly (readonly [string, readonly BookMetadata[]])[];
  readonly hasAnyCollection: boolean;
  readonly handleOpenBook: (book: BookMetadata) => void;
}

export function useLibraryCollections({
  books: propBooks,
  onOpenBook,
}: UseLibraryCollectionsOptions = {}): LibraryCollectionsViewModel {
  const storeBooks = useLibraryStore((s) => s.books);
  const navigation = useNavigation();

  const books = propBooks ?? storeBooks;
  const handleOpenBook = onOpenBook ?? navigation.openReader;

  const collectionsByTag = useMemo(() => groupBooksByTag(books), [books]);
  const collectionsByAuthor = useMemo(() => groupBooksByAuthor(books), [books]);
  const hasAnyCollection = collectionsByTag.length > 0 || collectionsByAuthor.length > 0;

  return {
    collectionsByTag,
    collectionsByAuthor,
    hasAnyCollection,
    handleOpenBook,
  };
}
