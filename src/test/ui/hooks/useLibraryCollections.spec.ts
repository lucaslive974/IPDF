import type { BookMetadata } from '@domain/BookMetadata';
import { groupBooksByAuthor, groupBooksByTag } from '@hooks/useLibraryCollections';
import { describe, expect, it } from 'vitest';

const makeBook = (
  hash: string,
  title: string,
  author: string,
  tags: string[] = []
): BookMetadata => ({
  bookHash: hash,
  title,
  author,
  format: 'epub',
  currentPage: 1,
  totalPages: 100,
  percentage: 1,
  tags,
  lastReadAt: new Date(1_700_000_000),
  updatedAt: new Date(1_700_000_000),
});

describe('useLibraryCollections logic and helpers', () => {
  describe('groupBooksByTag', () => {
    it('returns empty array when books list is empty or books have no tags', () => {
      expect(groupBooksByTag([])).toEqual([]);
      expect(groupBooksByTag([makeBook('b1', 'Book 1', 'Author 1', [])])).toEqual([]);
      expect(groupBooksByTag([makeBook('b1', 'Book 1', 'Author 1', ['   '])])).toEqual([]);
    });

    it('groups books by tag and sorts tags alphabetically', () => {
      const b1 = makeBook('b1', 'The Republic', 'Plato', ['Philosophy', 'Politics']);
      const b2 = makeBook('b2', 'Meditations', 'Marcus Aurelius', ['Philosophy', 'Stoicism']);
      const b3 = makeBook('b3', 'Leviathan', 'Thomas Hobbes', ['Politics']);

      const grouped = groupBooksByTag([b1, b2, b3]);

      expect(grouped.map(([tag]) => tag)).toEqual(['Philosophy', 'Politics', 'Stoicism']);

      const philosophyBooks = grouped.find(([tag]) => tag === 'Philosophy')?.[1];
      expect(philosophyBooks?.map((b) => b.title)).toEqual(['The Republic', 'Meditations']);

      const politicsBooks = grouped.find(([tag]) => tag === 'Politics')?.[1];
      expect(politicsBooks?.map((b) => b.title)).toEqual(['The Republic', 'Leviathan']);

      const stoicismBooks = grouped.find(([tag]) => tag === 'Stoicism')?.[1];
      expect(stoicismBooks?.map((b) => b.title)).toEqual(['Meditations']);
    });
  });

  describe('groupBooksByAuthor', () => {
    it('returns empty array when no books have valid authors', () => {
      expect(groupBooksByAuthor([])).toEqual([]);
      expect(groupBooksByAuthor([makeBook('b1', 'Book 1', 'Unknown')])).toEqual([]);
      expect(groupBooksByAuthor([makeBook('b2', 'Book 2', 'Local File')])).toEqual([]);
      expect(groupBooksByAuthor([makeBook('b3', 'Book 3', '   ')])).toEqual([]);
    });

    it('groups books by author and sorts authors alphabetically', () => {
      const b1 = makeBook('b1', 'The Republic', 'Plato');
      const b2 = makeBook('b2', 'Symposium', 'Plato');
      const b3 = makeBook('b3', 'Meditations', 'Marcus Aurelius');
      const b4 = makeBook('b4', 'Untitled File', 'Local File'); // Filtered out

      const grouped = groupBooksByAuthor([b1, b2, b3, b4]);

      expect(grouped.map(([author]) => author)).toEqual(['Marcus Aurelius', 'Plato']);

      const marcusBooks = grouped.find(([author]) => author === 'Marcus Aurelius')?.[1];
      expect(marcusBooks?.map((b) => b.title)).toEqual(['Meditations']);

      const platoBooks = grouped.find(([author]) => author === 'Plato')?.[1];
      expect(platoBooks?.map((b) => b.title)).toEqual(['The Republic', 'Symposium']);
    });
  });
});
