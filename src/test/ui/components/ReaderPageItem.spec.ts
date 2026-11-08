import { ReaderPageHeader } from '@components/reader/ReaderPageHeader';
import { ReaderPageItem } from '@components/reader/ReaderPageItem';
import { BookFormat } from '@domain/types';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('ReaderPageHeader', () => {
  it('renders chapter title, author, and page number', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderPageHeader, {
        chapterTitle: 'Chapter 1: The Beginning',
        bookAuthor: 'Marcus Aurelius',
        pageNumber: 1,
        totalPages: 100,
        cssFontFamily: 'sans-serif',
      })
    );

    expect(markup).toContain('Chapter 1: The Beginning');
    expect(markup).toContain('Marcus Aurelius • Page 1 of 100');
  });

  it('renders without author prefix when author is not provided', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderPageHeader, {
        chapterTitle: 'Introduction',
        pageNumber: 5,
        totalPages: 50,
        cssFontFamily: 'serif',
      })
    );

    expect(markup).toContain('Introduction');
    expect(markup).toContain('Page 5 of 50');
    expect(markup).not.toContain('•');
  });
});

describe('ReaderPageItem running header and chapter header behavior', () => {
  const defaultPage = {
    pageNumber: 2,
    chapterTitle: 'Chapter 2: Motion',
    paragraphs: ['First paragraph of chapter 2.', 'Second paragraph.'],
    cfiBase: 'page-2',
  };

  const renderItem = (props: Partial<React.ComponentProps<typeof ReaderPageItem>> = {}) => {
    return renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        null,
        React.createElement(ReaderPageItem, {
          page: defaultPage,
          totalPages: 10,
          bookTitle: 'Physics',
          bookAuthor: 'Aristotle',
          bookFormat: BookFormat.EPUB,
          highlights: [],
          showChapterHeader: true,
          onHighlightClick: vi.fn(),
          onHighlightContextMenu: vi.fn(),
          ...props,
        })
      )
    );
  };

  it('renders ReaderPageHeader when showChapterHeader is true for EPUB', () => {
    const markup = renderItem({ showChapterHeader: true });

    // Prominent chapter heading
    expect(markup).toContain('<h2');
    expect(markup).toContain('Chapter 2: Motion</h2>');
  });

  it('omits ReaderPageHeader when showChapterHeader is false for EPUB', () => {
    const markup = renderItem({ showChapterHeader: false });

    // Big chapter title is omitted to prevent repeated headings across continuing pages
    expect(markup).not.toContain('<h2');
    expect(markup).not.toContain('Chapter 2: Motion</h2>');
  });

  it('omits ReaderPageHeader completely for PDF format', () => {
    const markup = renderItem({
      bookFormat: BookFormat.PDF,
      showChapterHeader: true,
    });

    expect(markup).not.toContain('<h2');
    expect(markup).not.toContain('Chapter 2: Motion</h2>');
    expect(markup).toContain('data-testid="reader-page-pdf-2"');
  });
});
