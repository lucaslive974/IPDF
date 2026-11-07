import { formatMarkdownSelection, formatMarkdownStyle } from '@utils/markdownFormatting';
import { describe, expect, it } from 'vitest';

describe('markdownFormatting utility', () => {
  it('formats text for each supported style kind', () => {
    expect(formatMarkdownStyle('hello', { kind: 'bold' })).toBe('**hello**');
    expect(formatMarkdownStyle('hello', { kind: 'italic' })).toBe('*hello*');
    expect(formatMarkdownStyle('hello', { kind: 'underline' })).toBe('<u>hello</u>');
    expect(formatMarkdownStyle('hello', { kind: 'strikethrough' })).toBe('~~hello~~');
    expect(formatMarkdownStyle('hello', { kind: 'textColor', colorHex: '#d97706' })).toBe(
      '<span style="color:#d97706">hello</span>'
    );
    expect(formatMarkdownStyle('hello', { kind: 'backgroundColor', colorHex: '#ffeb3b' })).toBe(
      '<mark style="background-color:#ffeb3b">hello</mark>'
    );
    expect(formatMarkdownStyle('Title', { kind: 'heading', level: 2 })).toBe('## Title');
    expect(formatMarkdownStyle('one\ntwo', { kind: 'bulletList' })).toBe('- one\n- two');
    expect(formatMarkdownStyle('one\ntwo', { kind: 'orderedList' })).toBe('1. one\n2. two');
    expect(formatMarkdownStyle('quote', { kind: 'blockquote' })).toBe('> quote');
  });

  it('formats selection within a larger content string', () => {
    const content = 'Hello beautiful world!';
    const range = { start: 6, end: 15 }; // "beautiful"
    const result = formatMarkdownSelection(content, range, { kind: 'bold' });
    expect(result).toBe('Hello **beautiful** world!');
  });

  it('clamps invalid ranges gracefully', () => {
    const content = 'Word';
    const result = formatMarkdownSelection(content, { start: -5, end: 50 }, { kind: 'italic' });
    expect(result).toBe('*Word*');
  });
});
