import type { ReaderHighlightsController } from '@hooks/useReaderHighlights';
import type { ReaderPaginationController } from '@hooks/useReaderPagination';
import { NavigationProvider } from '@providers/NavigationContext';
import { type ReaderContextValue, ReaderProvider, useReader } from '@providers/ReaderContext';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('ReaderContext & ReaderProvider', () => {
  it('throws an error when useReader is used outside ReaderProvider', () => {
    function Consumer() {
      useReader();
      return null;
    }

    expect(() => {
      renderToStaticMarkup(React.createElement(Consumer));
    }).toThrow('useReader must be used within a ReaderProvider');
  });

  it('provides injected controllers when value prop is passed', () => {
    const injected: ReaderContextValue = {
      pagination: {} as ReaderPaginationController,
      highlights: {} as ReaderHighlightsController,
    };
    let captured: ReaderContextValue | null = null;

    function Consumer() {
      captured = useReader();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(ReaderProvider, { value: injected }, React.createElement(Consumer))
    );

    expect(captured).toBe(injected);
  });

  it('exposes only pagination and highlights controllers from the default session', () => {
    const backend = new MockBackend();
    let captured: ReaderContextValue | null = null;

    function Consumer() {
      captured = useReader();
      return null;
    }

    renderToStaticMarkup(
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
          React.createElement(ReaderProvider, null, React.createElement(Consumer))
        )
      )
    );

    const value = captured as ReaderContextValue | null;
    expect(value).not.toBeNull();
    expect(Object.keys(value ?? {}).sort()).toEqual(['highlights', 'pagination']);
    expect(typeof value?.pagination.goToPage).toBe('function');
    expect(typeof value?.pagination.onPageVisible).toBe('function');
    expect(typeof value?.highlights.loadBookHighlights).toBe('function');
    expect(typeof value?.highlights.deleteHighlight).toBe('function');
  });
});
