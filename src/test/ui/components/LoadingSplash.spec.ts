import { LoadingSplash } from '@ui';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('LoadingSplash component', () => {
  it('renders the WebGL 3D book canvas with default Scholarium branding', () => {
    const markup = renderToStaticMarkup(
      React.createElement(LoadingSplash, {
        status: 'loading',
        error: null,
        onRetry: vi.fn(),
        testId: 'startup-splash',
      })
    );

    expect(markup).toContain('data-testid="startup-splash"');
    expect(markup).toContain('data-testid="loading-splash-book-canvas"');
    expect(markup).toContain('Scholarium');
    expect(markup).toContain('Active Study Reader');
    expect(markup).toContain('Preparing your active study library');
    expect(markup).not.toContain('Retry Initialization');
  });

  it('renders custom book title, author subtitle, and loading message', () => {
    const markup = renderToStaticMarkup(
      React.createElement(LoadingSplash, {
        title: 'Clean Architecture',
        subtitle: 'Robert C. Martin',
        message: 'Preparing book for reading...',
        testId: 'reader-loading-view',
      })
    );

    expect(markup).toContain('data-testid="reader-loading-view"');
    expect(markup).toContain('Clean Architecture');
    expect(markup).toContain('Robert C. Martin');
    expect(markup).toContain('Preparing book for reading...');
  });

  it('omits subtitle when blank and renders error state with retry button', () => {
    const markup = renderToStaticMarkup(
      React.createElement(LoadingSplash, {
        subtitle: '',
        status: 'error',
        error: 'Database migration failed',
        onRetry: vi.fn(),
      })
    );

    expect(markup).not.toContain('Active Study Reader');
    expect(markup).toContain('data-testid="loading-splash-error"');
    expect(markup).toContain('Database migration failed');
    expect(markup).toContain('Retry Initialization');
  });
});
