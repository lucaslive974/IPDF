import { BookCard } from '@components/library/BookCard';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('BookCard', () => {
  const baseBook: BookMetadata = {
    bookHash: 'book-hash-1',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    format: BookFormat.EPUB,
    currentPage: 1,
    totalPages: 150,
    percentage: 0,
    tags: ['Stoicism', 'Philosophy'],
    lastReadAt: new Date(1_700_000_000_000),
    updatedAt: new Date(1_700_000_000_000),
  };

  it('renders unread status gracefully without empty progress bar', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BookCard, {
        book: baseBook,
        onOpenBook: vi.fn(),
      })
    );

    expect(markup).toContain('Meditations');
    expect(markup).toContain('Marcus Aurelius');
    expect(markup).toContain('150 pages');
    expect(markup).toContain('Unread');
    expect(markup).toContain('epub');
    // In unread mode, percentage numbers and progress bars are not rendered in footer
    expect(markup).not.toContain('Page 1 of');
  });

  it('omits placeholder or unknown author cleanly', () => {
    const bookWithoutAuthor: BookMetadata = {
      ...baseBook,
      author: 'Unknown',
    };
    const markup = renderToStaticMarkup(
      React.createElement(BookCard, {
        book: bookWithoutAuthor,
        onOpenBook: vi.fn(),
      })
    );

    expect(markup).toContain('Meditations');
    expect(markup).not.toContain('Unknown');
    expect(markup).not.toContain('Local File');
  });

  it('renders active progress when book is in progress', () => {
    const inProgressBook: BookMetadata = {
      ...baseBook,
      currentPage: 30,
      percentage: 20,
    };
    const markup = renderToStaticMarkup(
      React.createElement(BookCard, {
        book: inProgressBook,
        onOpenBook: vi.fn(),
      })
    );

    expect(markup).toContain('Page 30 of 150');
    expect(markup).toContain('20%');
    expect(markup).not.toContain('Unread');
  });

  it('renders completed state when book is at 100%', () => {
    const completedBook: BookMetadata = {
      ...baseBook,
      currentPage: 150,
      percentage: 100,
    };
    const markup = renderToStaticMarkup(
      React.createElement(BookCard, {
        book: completedBook,
        onOpenBook: vi.fn(),
      })
    );

    expect(markup).toContain('Completed');
    expect(markup).not.toContain('Unread');
  });

  it('renders tags when provided', () => {
    const markup = renderToStaticMarkup(
      React.createElement(BookCard, {
        book: baseBook,
        onOpenBook: vi.fn(),
      })
    );

    expect(markup).toContain('Stoicism');
    expect(markup).toContain('Philosophy');
  });
});
