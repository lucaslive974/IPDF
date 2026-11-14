import { StartupSplash } from '@components/StartupSplash';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('StartupSplash component', () => {
  it('renders the WebGL 3D book canvas and loading status', () => {
    const markup = renderToStaticMarkup(
      React.createElement(StartupSplash, {
        status: 'loading',
        error: null,
        onRetry: vi.fn(),
      })
    );

    expect(markup).toContain('data-testid="startup-splash"');
    expect(markup).toContain('data-testid="startup-book-canvas"');
    expect(markup).toContain('Scholarium');
    expect(markup).toContain('Preparing your active study library');
    expect(markup).not.toContain('Retry Initialization');
  });

  it('renders error state and retry button when startup initialization fails', () => {
    const markup = renderToStaticMarkup(
      React.createElement(StartupSplash, {
        status: 'error',
        error: 'Database migration failed',
        onRetry: vi.fn(),
      })
    );

    expect(markup).toContain('data-testid="startup-error"');
    expect(markup).toContain('Database migration failed');
    expect(markup).toContain('Retry Initialization');
  });
});
