import { describe, expect, it } from 'vitest';
import { filterSuggestions } from '../../../ui/components/ui/AutocompleteInput';

describe('AutocompleteInput logic', () => {
  describe('filterSuggestions', () => {
    const sampleAuthors = [
      'Marcus Aurelius',
      'Plato',
      'Aristotle',
      'Friedrich Nietzsche',
      'Baruch Spinoza',
    ];

    it('returns all suggestions when query is empty or whitespace', () => {
      expect(filterSuggestions(sampleAuthors, '')).toEqual(sampleAuthors);
      expect(filterSuggestions(sampleAuthors, '   ')).toEqual(sampleAuthors);
    });

    it('filters suggestions matching case-insensitively', () => {
      const result = filterSuggestions(sampleAuthors, 'marcus');
      expect(result).toEqual(['Marcus Aurelius']);

      const resultUpper = filterSuggestions(sampleAuthors, 'PLATO');
      expect(resultUpper).toEqual(['Plato']);
    });

    it('matches partial substrings across suggestion names', () => {
      // Matches both 'Aristotle' and 'Baruch Spinoza' if they share characters, or 'ar'
      const result = filterSuggestions(sampleAuthors, 'ar');
      expect(result).toEqual(['Marcus Aurelius', 'Aristotle', 'Baruch Spinoza']);
    });

    it('returns empty array when no suggestion matches', () => {
      expect(filterSuggestions(sampleAuthors, 'Descartes')).toEqual([]);
    });

    it('handles empty suggestions list safely', () => {
      expect(filterSuggestions([], 'query')).toEqual([]);
    });
  });
});
