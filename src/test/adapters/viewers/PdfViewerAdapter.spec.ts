import { PdfViewerAdapter } from '@adapters/viewers/PdfViewerAdapter';
import { Highlight } from '@domain/Highlight';
import { BookFormat, type PageInfo, type TextSelection } from '@domain/types';
import type { IPdfEngine, PdfDocumentProxy, PdfPageProxy } from '@ports/IPdfEngine';
import { describe, expect, it, vi } from 'vitest';

function createFakeContainer(): HTMLElement {
  const attributes = new Map<string, string>();
  const fakeElement = {
    innerHTML: '',
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string): string | null {
      return attributes.get(name) ?? null;
    },
  };
  return fakeElement as unknown as HTMLElement;
}

function createMockPdfEngine(): IPdfEngine {
  const pages: PdfPageProxy[] = [
    {
      pageNumber: 1,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({
        items: [
          { str: 'Introduction to Metaphysics.' },
          { str: '' },
          { str: 'Being and time are fundamentally interconnected.' },
        ],
      }),
      render: vi.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    },
    {
      pageNumber: 2,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({
        items: [{ str: 'Chapter Two: Phenomenological reduction.' }],
      }),
      render: vi.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    },
    {
      pageNumber: 3,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({
        items: [{ str: 'Conclusion and outlook.' }],
      }),
    },
  ];

  const docProxy: PdfDocumentProxy = {
    numPages: 3,
    getPage: async (num: number) => {
      const p = pages[num - 1];
      if (!p) {
        throw new Error(`Page ${num} not found`);
      }
      return p;
    },
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  return {
    loadDocument: async () => docProxy,
  };
}

describe('PdfViewerAdapter (PDF.js Engine, Canvas & AABB Highlights)', () => {
  it('renders PDF pages, navigates, and emits onPageChanged', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    const pageEvents: PageInfo[] = [];
    viewer.onPageChanged((info) => pageEvents.push(info));

    await viewer.render(container, new ArrayBuffer(16));

    expect(viewer.getCurrentPage()).toEqual({
      currentPage: 1,
      totalPages: 3,
      chapterTitle: 'Page 1',
      percentage: 33,
    });

    await viewer.nextPage();
    expect(viewer.getCurrentPage().currentPage).toBe(2);

    await viewer.prevPage();
    expect(viewer.getCurrentPage().currentPage).toBe(1);

    await viewer.goToPage(3);
    expect(viewer.getCurrentPage().currentPage).toBe(3);

    await viewer.goToPage('page-2');
    expect(viewer.getCurrentPage().currentPage).toBe(2);

    expect(pageEvents.length).toBeGreaterThanOrEqual(4);

    const page1 = viewer.getPage(1);
    expect(page1).not.toBeNull();
    expect(page1?.paragraphs).toEqual([
      'Introduction to Metaphysics.',
      'Being and time are fundamentally interconnected.',
    ]);

    const chunk = viewer.getPagesChunk(1, 2);
    expect(chunk).toHaveLength(2);

    expect(viewer.getParagraphsForChapter(0)).toEqual([
      'Introduction to Metaphysics.',
      'Being and time are fundamentally interconnected.',
    ]);
  });

  it('manages text selection and clearSelection events', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const selectionEvents: Array<TextSelection | null> = [];
    viewer.onTextSelected((s) => selectionEvents.push(s));

    viewer.simulateTextSelection('Being and time', [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }]);

    const current = viewer.getSelection();
    expect(current).not.toBeNull();
    expect(current?.text).toBe('Being and time');
    expect(current?.anchor.format).toBe(BookFormat.PDF);
    expect(current?.anchor.pdfRects).toHaveLength(1);

    viewer.clearSelection();
    expect(viewer.getSelection()).toBeNull();
    expect(selectionEvents).toHaveLength(2);
    expect(selectionEvents[1]).toBeNull();
  });

  it('renders and filters highlights per page and handles click events', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const hl1 = new Highlight('hl-1', 'book-1', 'Quote 1', '#fbbf24', {
      format: BookFormat.PDF,
      pageNumber: 1,
      pdfRects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.04 }],
    });
    const hl2 = new Highlight('hl-2', 'book-1', 'Quote 2', '#60a5fa', {
      format: BookFormat.PDF,
      pageNumber: 2,
      pdfRects: [{ x: 0.3, y: 0.4, width: 0.4, height: 0.04 }],
    });

    viewer.renderHighlights([hl1, hl2]);

    expect(viewer.getHighlightsForPage(1)).toHaveLength(1);
    expect(viewer.getHighlightsForPage(1)[0]?.id).toBe('hl-1');
    expect(viewer.getHighlightsForPage(2)).toHaveLength(1);
    expect(viewer.getHighlightsForPage(3)).toHaveLength(0);

    const clickedHighlights: Highlight[] = [];
    viewer.onHighlightClicked((hl) => clickedHighlights.push(hl));

    viewer.triggerHighlightClick('hl-1');
    expect(clickedHighlights).toHaveLength(1);
    expect(clickedHighlights[0]?.id).toBe('hl-1');

    viewer.eraseHighlightFromDOM('hl-1');
    expect(viewer.getHighlightsForPage(1)).toHaveLength(0);

    viewer.injectInlineAnnotation(
      { format: BookFormat.PDF, pageNumber: 1, pdfRects: [] },
      'Nota rápida'
    );
  });

  it('extracts visible sentences for TTS and updates active sentence', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const sentences = await viewer.extractVisibleSentences();
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.text).toBe('Introduction to Metaphysics.');
    expect(sentences[0]?.anchor.format).toBe(BookFormat.PDF);
    expect(sentences[0]?.id).toBe('pdf-sentence-p1-1');

    viewer.setActiveTTSSentence('pdf-sentence-p1-1');
    expect(viewer.getActiveTTSSentenceId()).toBe('pdf-sentence-p1-1');
  });

  it('renders page to canvas via renderPageCanvas and handles invalid proxies safely', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
    } as unknown as HTMLCanvasElement;

    const dimensions = await viewer.renderPageCanvas(1, fakeCanvas, 1.0);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);

    const invalidDims = await viewer.renderPageCanvas(999, fakeCanvas, 1.0);
    expect(invalidDims).toEqual({ width: 0, height: 0 });

    const proxy = await viewer.getPageProxy(1);
    expect(proxy).not.toBeNull();
    expect(proxy?.pageNumber).toBe(1);

    const invalidProxy = await viewer.getPageProxy(99);
    expect(invalidProxy).toBeNull();
  });

  it('renders text layer via renderPageTextLayer setting scale variables and spans', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const styleProperties = new Map<string, string>();
    const fakeTextContainer = {
      innerHTML: 'previous',
      style: {
        setProperty: (key: string, val: string) => styleProperties.set(key, val),
      },
    } as unknown as HTMLElement;

    await viewer.renderPageTextLayer(1, fakeTextContainer, 1.25);

    expect(fakeTextContainer.innerHTML).toBe('');
    expect(styleProperties.get('--scale-factor')).toBe('1.25');
    expect(styleProperties.get('--total-scale-factor')).toBe('1.25');
    expect(styleProperties.get('--user-unit')).toBe('1');

    // Safe handling when proxy does not exist
    await viewer.renderPageTextLayer(999, fakeTextContainer, 1.25);
  });

  it('lazily extracts pages on demand for documents larger than 5 pages', async () => {
    const pageProxies: PdfPageProxy[] = Array.from({ length: 8 }, (_, idx) => ({
      pageNumber: idx + 1,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({
        items: [{ str: `Extracted text from page ${idx + 1}` }],
      }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    }));

    const mockEngine: IPdfEngine = {
      loadDocument: async () => ({
        numPages: 8,
        getPage: async (num) => {
          const p = pageProxies[num - 1];
          if (!p) throw new Error(`Page ${num} not found`);
          return p;
        },
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const viewer = new PdfViewerAdapter(mockEngine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    // Initially only 5 pages were extracted; page 7 has stub paragraph before extraction
    expect(viewer.getCurrentPage().totalPages).toBe(8);
    const page7Stub = viewer.getPage(7);
    expect(page7Stub?.paragraphs).toEqual(['[Page 7]']);

    // Now extract chunk 6..8 on demand
    const extractedChunk = await viewer.ensurePagesExtracted(6, 3);
    expect(extractedChunk).toHaveLength(3);
    expect(extractedChunk[0]?.paragraphs).toEqual(['Extracted text from page 6']);
    expect(extractedChunk[1]?.paragraphs).toEqual(['Extracted text from page 7']);
    expect(extractedChunk[2]?.paragraphs).toEqual(['Extracted text from page 8']);

    // Subsequent retrieval has cached extracted paragraphs
    expect(viewer.getPage(7)?.paragraphs).toEqual(['Extracted text from page 7']);
  });

  it('cleans up resources on destroy', async () => {
    const engine = createMockPdfEngine();
    const viewer = new PdfViewerAdapter(engine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    viewer.destroy();
    expect(viewer.getPage(1)).toBeNull();
    expect(viewer.getCurrentPage().totalPages).toBe(1);
  });
});
