import { PdfHighlightLayer } from '@components/reader/PdfHighlightLayer';
import { PAGE_RENDERERS, ReaderPageItem } from '@components/reader/ReaderPageItem';
import { ReaderPageParagraphs } from '@components/reader/ReaderPageParagraphs';
import { ReaderPagePdf } from '@components/reader/ReaderPagePdf';
import { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('PdfHighlightLayer and PAGE_RENDERERS', () => {
  it('registers correct components in PAGE_RENDERERS handler map', () => {
    expect(PAGE_RENDERERS[BookFormat.EPUB]).toBe(ReaderPageParagraphs);
    expect(PAGE_RENDERERS[BookFormat.PDF]).toBe(ReaderPagePdf);
  });

  it('renders bounding box overlays only for matching page highlights', () => {
    const hlPage1 = new Highlight('hl-1', 'book-hash', 'Logos and Cosmos', '#f59e0b', {
      format: BookFormat.PDF,
      pageNumber: 1,
      pdfRects: [
        { x: 0.1, y: 0.2, width: 0.5, height: 0.04 },
        { x: 0.1, y: 0.25, width: 0.3, height: 0.04 },
      ],
    });

    const hlPage2 = new Highlight('hl-2', 'book-hash', 'Different page text', '#3b82f6', {
      format: BookFormat.PDF,
      pageNumber: 2,
      pdfRects: [{ x: 0.2, y: 0.3, width: 0.4, height: 0.05 }],
    });

    const hlNoRects = new Highlight('hl-3', 'book-hash', 'No rects text', '#10b981', {
      format: BookFormat.PDF,
      pageNumber: 1,
      pdfRects: [],
    });

    const markup = renderToStaticMarkup(
      React.createElement(PdfHighlightLayer, {
        pageNumber: 1,
        highlights: [hlPage1, hlPage2, hlNoRects],
        onHighlightClick: vi.fn(),
        onHighlightContextMenu: vi.fn(),
      })
    );

    expect(markup).toContain('data-testid="pdf-highlight-layer-1"');
    expect(markup).toContain('data-testid="pdf-highlight-rect-hl-1-0"');
    expect(markup).toContain('data-testid="pdf-highlight-rect-hl-1-1"');
    expect(markup).toContain('aria-label="Highlight: Logos and Cosmos"');
    expect(markup).toContain('left:10%');
    expect(markup).toContain('top:20%');
    expect(markup).toContain('width:50%');

    // Should NOT contain highlights from page 2 or highlights with empty rects
    expect(markup).not.toContain('data-testid="pdf-highlight-rect-hl-2-0"');
    expect(markup).not.toContain('data-testid="pdf-highlight-rect-hl-3"');
  });

  it('renders ReaderPageItem with PDF renderer when bookFormat is BookFormat.PDF', () => {
    const page = {
      pageNumber: 2,
      chapterTitle: 'Page 2',
      paragraphs: ['Sample text paragraph from PDF.'],
      cfiBase: 'page-2',
    };

    const markup = renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        null,
        React.createElement(ReaderPageItem, {
          page,
          totalPages: 10,
          bookTitle: 'Meditations',
          bookAuthor: 'Marcus Aurelius',
          bookFormat: BookFormat.PDF,
          highlights: [],
          onHighlightClick: vi.fn(),
          onHighlightContextMenu: vi.fn(),
        })
      )
    );

    expect(markup).toContain('data-page-number="2"');
    expect(markup).toContain('data-testid="reader-page-pdf-2"');
    expect(markup).toContain('data-testid="pdf-canvas-2"');
    expect(markup).toContain('data-testid="pdf-text-layer-2"');
  });
});
