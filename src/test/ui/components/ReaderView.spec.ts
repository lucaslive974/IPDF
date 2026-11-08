import { ReaderView } from '@components/ReaderView';
import { BookFormat } from '@domain/types';
import { NavigationProvider } from '@providers/NavigationContext';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('ReaderView component', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
    useReaderStore.getState().reset();
  });

  it('renders ReaderView successfully with ServiceContainerProvider and NavigationProvider', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        {
          readerService: backend,
          libraryService: backend,
          highlightService: backend,
          presenceService: backend,
        },
        React.createElement(
          NavigationProvider,
          null,
          React.createElement(ReaderView, {
            book: {
              bookHash: 'book-hash-1',
              title: 'Critique of Pure Reason',
              author: 'Immanuel Kant',
              format: BookFormat.EPUB,
              currentPage: 1,
              totalPages: 50,
              percentage: 0.02,
              tags: [],
              lastReadAt: new Date(),
              updatedAt: new Date(),
            },
            onClose: () => {},
          })
        )
      )
    );

    expect(markup).toContain('Book Reader Document');
    expect(markup).toContain('Preparing book for reading');
  });
});
