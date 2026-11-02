import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import { NavigationProvider, useNavigation } from '@providers/NavigationContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('NavigationContext & useNavigation', () => {
  const dummyBook: BookMetadata = {
    bookHash: 'nav-test-book',
    title: 'The Republic',
    author: 'Plato',
    format: BookFormat.EPUB,
    currentPage: 1,
    totalPages: 300,
    percentage: 0,
    tags: [],
    lastReadAt: new Date(1_700_000_000_000),
    updatedAt: new Date(1_700_000_000_000),
  };

  function ConsumerComponent() {
    const { currentView, selectedBook } = useNavigation();
    return React.createElement(
      'div',
      { 'data-testid': 'nav-consumer' },
      `${currentView}-${selectedBook?.title ?? 'none'}`
    );
  }

  it('throws error when used outside NavigationProvider', () => {
    expect(() => renderToStaticMarkup(React.createElement(ConsumerComponent))).toThrow(
      'useNavigation must be used within a NavigationProvider'
    );
  });

  it('renders default library view with no selected book', () => {
    const markup = renderToStaticMarkup(
      React.createElement(NavigationProvider, null, React.createElement(ConsumerComponent))
    );
    expect(markup).toContain('library-none');
  });

  it('renders custom initial view when provided', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        NavigationProvider,
        { initialView: 'settings' },
        React.createElement(ConsumerComponent)
      )
    );
    expect(markup).toContain('settings-none');
  });

  it('provides navigation action methods', () => {
    let capturedNav: ReturnType<typeof useNavigation> | null = null;
    function ActionTester() {
      capturedNav = useNavigation();
      return null;
    }

    renderToStaticMarkup(
      React.createElement(NavigationProvider, null, React.createElement(ActionTester))
    );

    if (!capturedNav) {
      throw new Error('capturedNav is null');
    }

    const nav = capturedNav as ReturnType<typeof useNavigation>;
    expect(typeof nav.openReader).toBe('function');
    expect(typeof nav.closeReader).toBe('function');
    expect(typeof nav.openSettings).toBe('function');
    expect(typeof nav.closeSettings).toBe('function');
    expect(typeof nav.setCurrentView).toBe('function');

    // Test calling methods for code coverage
    nav.openReader(dummyBook);
    nav.closeReader();
    nav.openSettings();
    nav.closeSettings();
    nav.setCurrentView('library');
  });
});
