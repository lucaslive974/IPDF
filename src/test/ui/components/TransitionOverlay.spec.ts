import { TransitionOverlay } from '@ui';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('TransitionOverlay component', () => {
  it('renders null when isVisible is false', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        TransitionOverlay,
        { isVisible: false },
        React.createElement('div', null, 'Loading Content')
      )
    );

    expect(markup).toBe('');
  });

  it('renders fixed overlay container with children when isVisible is true', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        TransitionOverlay,
        {
          isVisible: true,
          className: 'bg-canvas flex items-center justify-center',
          zIndexClass: 'z-50',
          durationMs: 400,
        },
        React.createElement('p', null, 'Preparing Book...')
      )
    );

    expect(markup).toContain('data-testid="transition-overlay"');
    expect(markup).toContain('fixed inset-0 z-50 bg-canvas');
    expect(markup).toContain('Preparing Book...');
    expect(markup).toContain('opacity:1');
    expect(markup).toContain('transition:opacity 400ms');
    expect(markup).toContain('pointer-events:auto');
  });

  it('applies default z-index class when zIndexClass is omitted', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        TransitionOverlay,
        { isVisible: true },
        React.createElement('span', null, 'Test')
      )
    );

    expect(markup).toContain('z-30');
  });
});
