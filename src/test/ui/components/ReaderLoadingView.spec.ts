import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReaderLoadingView } from '../../../ui/components/reader/ReaderLoadingView';
import type { StudyDocumentDescriptor } from '../../../ui/stores/useReaderStore';

describe('ReaderLoadingView', () => {
  const mockDoc: StudyDocumentDescriptor = {
    bookHash: 'test-hash-123',
    bookTitle: 'Structure and Interpretation of Computer Programs',
    bookAuthor: 'Harold Abelson & Gerald Jay Sussman',
    chapterTitle: 'Chapter 1',
    sampleParagraph: 'Sample paragraph text.',
  };

  it('renders book title, author, and loading status indicator', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderLoadingView, { document: mockDoc })
    );

    expect(markup).toContain('data-testid="reader-loading-view"');
    expect(markup).toContain('Structure and Interpretation of Computer Programs');
    expect(markup).toContain('Harold Abelson &amp; Gerald Jay Sussman');
    expect(markup).toContain('Preparing book for reading...');
  });

  it('renders custom loading message when provided', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReaderLoadingView, {
        document: mockDoc,
        message: 'Loading PDF pages...',
      })
    );

    expect(markup).toContain('Loading PDF pages...');
  });

  it('handles unknown or missing author gracefully', () => {
    const docWithoutAuthor: StudyDocumentDescriptor = {
      ...mockDoc,
      bookAuthor: 'Unknown',
    };
    const markup = renderToStaticMarkup(
      React.createElement(ReaderLoadingView, { document: docWithoutAuthor })
    );

    expect(markup).not.toContain('Unknown');
  });
});
