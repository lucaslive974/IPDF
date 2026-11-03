import { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import {
  calculatePdfResponsiveScale,
  filterPageNotes,
  usePdfPageRenderer,
} from '@hooks/usePdfPageRenderer';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('usePdfPageRenderer helper functions', () => {
  it('calculates responsive scale from container width and viewport width', () => {
    // 800px container / 400px viewport = 2.0 scale
    expect(calculatePdfResponsiveScale(800, 400)).toBe(2.0);

    // 1024px container / 512px viewport = 2.0 scale
    expect(calculatePdfResponsiveScale(1024, 512)).toBe(2.0);
  });

  it('falls back to 768 default container width when clientWidth is 0 or negative', () => {
    // 768 default / 384 = 2.0
    expect(calculatePdfResponsiveScale(0, 384)).toBe(2.0);
    expect(calculatePdfResponsiveScale(-10, 384)).toBe(2.0);
  });

  it('returns default 1.5 scale when unscaled viewport width is 0 or negative', () => {
    expect(calculatePdfResponsiveScale(800, 0)).toBe(1.5);
    expect(calculatePdfResponsiveScale(800, -100)).toBe(1.5);
  });

  it('filters highlights for matching page number and non-empty notes', () => {
    const hlWithNote = new Highlight(
      'hl-1',
      'hash',
      'Text 1',
      '#f59e0b',
      {
        format: BookFormat.PDF,
        pageNumber: 2,
        pdfRects: [],
      },
      'Important observation'
    );

    const hlEmptyNote = new Highlight(
      'hl-2',
      'hash',
      'Text 2',
      '#3b82f6',
      {
        format: BookFormat.PDF,
        pageNumber: 2,
        pdfRects: [],
      },
      '   '
    );

    const hlOtherPage = new Highlight(
      'hl-3',
      'hash',
      'Text 3',
      '#10b981',
      {
        format: BookFormat.PDF,
        pageNumber: 1,
        pdfRects: [],
      },
      'Note on page 1'
    );

    const filtered = filterPageNotes([hlWithNote, hlEmptyNote, hlOtherPage], 2);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('hl-1');
  });

  it('renders hook within test component providing refs and page notes', () => {
    const hl = new Highlight(
      'hl-1',
      'hash',
      'Text 1',
      '#f59e0b',
      {
        format: BookFormat.PDF,
        pageNumber: 1,
        pdfRects: [],
      },
      'Page note'
    );

    function TestComponent() {
      const { containerRef, canvasRef, textLayerRef, pageNotes } = usePdfPageRenderer({
        pageNumber: 1,
        highlights: [hl],
      });

      return React.createElement(
        'div',
        { ref: containerRef, 'data-testid': 'test-container' },
        React.createElement('canvas', { ref: canvasRef, 'data-testid': 'test-canvas' }),
        React.createElement('div', { ref: textLayerRef, 'data-testid': 'test-text-layer' }),
        React.createElement('span', { 'data-testid': 'notes-count' }, pageNotes.length)
      );
    }

    const html = renderToStaticMarkup(
      React.createElement(ServiceContainerProvider, null, React.createElement(TestComponent))
    );

    expect(html).toContain('data-testid="test-container"');
    expect(html).toContain('data-testid="test-canvas"');
    expect(html).toContain('data-testid="test-text-layer"');
    expect(html).toContain('data-testid="notes-count">1<');
  });
});
