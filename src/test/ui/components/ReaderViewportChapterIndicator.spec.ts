import { ReaderViewportChapterIndicator } from '@components/reader/ReaderViewportChapterIndicator';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('ReaderViewportChapterIndicator', () => {
  it('renders fixed indicator with chapter title when isVisible is true', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderViewportChapterIndicator, {
        chapterTitle: 'Chapter 4: The Golden Mean',
        isVisible: true,
      })
    );

    expect(markup).toContain('data-testid="reader-viewport-chapter-indicator"');
    expect(markup).toContain('Chapter 4: The Golden Mean');
    expect(markup).toContain('fixed top-3 right-4');
  });

  it('renders nothing when isVisible is false', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderViewportChapterIndicator, {
        chapterTitle: 'Chapter 4: The Golden Mean',
        isVisible: false,
      })
    );

    expect(markup).toBe('');
  });

  it('renders nothing when chapterTitle is empty or undefined', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderViewportChapterIndicator, {
        chapterTitle: '',
        isVisible: true,
      })
    );

    expect(markup).toBe('');
  });
});
