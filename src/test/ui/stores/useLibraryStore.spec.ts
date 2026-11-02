import type { BookMetadata } from '@domain/BookMetadata';
import { useLibraryStore } from '@stores/useLibraryStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useLibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.getState().reset();
  });

  it('initializes with empty books and isLoading false', () => {
    const state = useLibraryStore.getState();
    expect(state.books).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('updates books with setBooks', () => {
    const mockBook: BookMetadata = {
      bookHash: 'hash-1',
      title: 'Title 1',
      author: 'Author 1',
      format: 'epub',
      currentPage: 1,
      totalPages: 100,
      percentage: 1,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    useLibraryStore.getState().setBooks([mockBook]);
    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useLibraryStore.getState().books[0]?.title).toBe('Title 1');
  });

  it('sets loading state', () => {
    useLibraryStore.getState().setLoading(true);
    expect(useLibraryStore.getState().isLoading).toBe(true);
  });

  it('upserts a new book to the front of the list', () => {
    const b1: BookMetadata = {
      bookHash: 'h1',
      title: 'Book 1',
      author: 'A1',
      format: 'epub',
      currentPage: 1,
      totalPages: 50,
      percentage: 2,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };
    const b2: BookMetadata = {
      bookHash: 'h2',
      title: 'Book 2',
      author: 'A2',
      format: 'pdf',
      currentPage: 5,
      totalPages: 100,
      percentage: 5,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    useLibraryStore.getState().setBooks([b1]);
    useLibraryStore.getState().upsertBook(b2);

    expect(useLibraryStore.getState().books).toHaveLength(2);
    expect(useLibraryStore.getState().books[0]?.bookHash).toBe('h2');
  });

  it('updates an existing book in place when upserted', () => {
    const b1: BookMetadata = {
      bookHash: 'h1',
      title: 'Book 1',
      author: 'A1',
      format: 'epub',
      currentPage: 1,
      totalPages: 50,
      percentage: 2,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };
    const updatedB1: BookMetadata = {
      ...b1,
      currentPage: 10,
      percentage: 20,
    };

    useLibraryStore.getState().setBooks([b1]);
    useLibraryStore.getState().upsertBook(updatedB1);

    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useLibraryStore.getState().books[0]?.currentPage).toBe(10);
    expect(useLibraryStore.getState().books[0]?.percentage).toBe(20);
  });

  it('renames a book in place using renameBook', () => {
    const b1: BookMetadata = {
      bookHash: 'h1',
      title: 'Original Title',
      author: 'A1',
      format: 'epub',
      currentPage: 1,
      totalPages: 50,
      percentage: 2,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    useLibraryStore.getState().setBooks([b1]);
    useLibraryStore.getState().renameBook('h1', 'Renamed Document Title');

    expect(useLibraryStore.getState().books[0]?.title).toBe('Renamed Document Title');
    expect(useLibraryStore.getState().books[0]?.bookHash).toBe('h1');
  });

  it('removes a book by bookHash using removeBook', () => {
    const b1: BookMetadata = {
      bookHash: 'h1',
      title: 'Book 1',
      author: 'A1',
      format: 'epub',
      currentPage: 1,
      totalPages: 50,
      percentage: 2,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };
    const b2: BookMetadata = {
      bookHash: 'h2',
      title: 'Book 2',
      author: 'A2',
      format: 'pdf',
      currentPage: 5,
      totalPages: 100,
      percentage: 5,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    useLibraryStore.getState().setBooks([b1, b2]);
    expect(useLibraryStore.getState().books).toHaveLength(2);

    useLibraryStore.getState().removeBook('h1');
    expect(useLibraryStore.getState().books).toHaveLength(1);
    expect(useLibraryStore.getState().books[0]?.bookHash).toBe('h2');
  });
});
