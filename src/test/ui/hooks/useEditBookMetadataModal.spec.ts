import {
  addTagDeduplicated,
  buildUpdateBookMetadataPayload,
  normalizeAuthor,
} from '@hooks/useEditBookMetadataModal';
import { describe, expect, it } from 'vitest';

describe('useEditBookMetadataModal logic and helpers', () => {
  describe('normalizeAuthor', () => {
    it('returns empty string for fallback placeholder authors', () => {
      expect(normalizeAuthor('Local File')).toBe('');
      expect(normalizeAuthor('Unknown')).toBe('');
      expect(normalizeAuthor('Unknown Author')).toBe('');
      expect(normalizeAuthor(null)).toBe('');
      expect(normalizeAuthor(undefined)).toBe('');
    });

    it('preserves valid author names with trimming', () => {
      expect(normalizeAuthor('  Marcus Aurelius  ')).toBe('Marcus Aurelius');
      expect(normalizeAuthor('Plato')).toBe('Plato');
    });
  });

  describe('addTagDeduplicated', () => {
    it('adds new trimmed tag to the list', () => {
      const initial = ['Philosophy'];
      const result = addTagDeduplicated(initial, '  Ethics  ');
      expect(result).toEqual(['Philosophy', 'Ethics']);
    });

    it('ignores empty and whitespace-only tags', () => {
      const initial = ['Philosophy'];
      expect(addTagDeduplicated(initial, '')).toEqual(['Philosophy']);
      expect(addTagDeduplicated(initial, '   ')).toEqual(['Philosophy']);
    });

    it('prevents case-insensitive duplicates', () => {
      const initial = ['Philosophy', 'Stoicism'];
      const result = addTagDeduplicated(initial, 'philosophy');
      expect(result).toEqual(['Philosophy', 'Stoicism']);

      const resultUpper = addTagDeduplicated(initial, 'STOICISM');
      expect(resultUpper).toEqual(['Philosophy', 'Stoicism']);
    });
  });

  describe('buildUpdateBookMetadataPayload', () => {
    it('returns null if title is empty or blank', () => {
      const payload1 = buildUpdateBookMetadataPayload(
        { title: '', author: 'Plato', description: '' },
        ['Tag']
      );
      expect(payload1).toBeNull();

      const payload2 = buildUpdateBookMetadataPayload(
        { title: '   ', author: 'Plato', description: '' },
        ['Tag']
      );
      expect(payload2).toBeNull();
    });

    it('builds valid payload with trimmed values and fallback author', () => {
      const payload = buildUpdateBookMetadataPayload(
        {
          title: '  The Republic  ',
          author: '',
          description: '  A dialogue on justice.  ',
        },
        ['Ancient Philosophy', 'Epistemology']
      );

      expect(payload).toEqual({
        title: 'The Republic',
        author: 'Unknown',
        tags: ['Ancient Philosophy', 'Epistemology'],
        description: 'A dialogue on justice.',
      });
    });

    it('preserves explicit author when provided', () => {
      const payload = buildUpdateBookMetadataPayload(
        {
          title: 'The Republic',
          author: 'Plato',
          description: '',
        },
        []
      );

      expect(payload).toEqual({
        title: 'The Republic',
        author: 'Plato',
        tags: [],
        description: undefined,
      });
    });
  });
});
