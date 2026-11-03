import { PdfViewerAdapter } from '@adapters/viewers/PdfViewerAdapter';
import type { PageInfo } from '@domain/types';
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

describe('PdfViewerAdapter (PDF.js Engine, Canvas & Cooperative Cancellation)', () => {
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
    expect(page1?.pageNumber).toBe(1);

    const chunk = viewer.getPagesChunk(1, 2);
    expect(chunk).toHaveLength(2);

    viewer.setPages([
      {
        pageNumber: 1,
        chapterTitle: 'Custom Page 1',
        paragraphs: ['Custom text'],
        cfiBase: 'page-1',
      },
    ]);
    expect(viewer.getPage(1)?.chapterTitle).toBe('Custom Page 1');
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

    // Fallback text layer span injection when document is present
    const originalDocument = globalThis.document;
    const appendChildMock = vi.fn();
    const fakeContainerWithDom = {
      innerHTML: '',
      style: { setProperty: vi.fn() },
      appendChild: appendChildMock,
    } as unknown as HTMLElement;
    globalThis.document = {
      createElement: vi.fn().mockReturnValue({ style: {} }),
    } as unknown as Document;

    try {
      await viewer.renderPageTextLayer(1, fakeContainerWithDom, 1.0);
      expect(appendChildMock).toHaveBeenCalled();
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('safely cancels previous in-flight render task when same canvas is rendered concurrently', async () => {
    let cancelCalled = false;
    let resolveFirstTask: (() => void) | undefined;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirstTask = resolve;
    });

    const mockPageProxy: PdfPageProxy = {
      pageNumber: 1,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({ items: [{ str: 'Text' }] }),
      render: vi
        .fn()
        .mockImplementationOnce(() => ({
          promise: firstPromise,
          cancel: () => {
            cancelCalled = true;
            const err = new Error('Rendering cancelled');
            err.name = 'RenderingCancelledException';
            resolveFirstTask?.();
          },
        }))
        .mockImplementationOnce(() => ({
          promise: Promise.resolve(),
          cancel: vi.fn(),
        })),
    };

    const mockEngine: IPdfEngine = {
      loadDocument: async () => ({
        numPages: 1,
        getPage: async () => mockPageProxy,
      }),
    };

    const viewer = new PdfViewerAdapter(mockEngine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(16));

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
    } as unknown as HTMLCanvasElement;

    // Start first render (leaves it in-flight)
    const firstRenderPromise = viewer.renderPageCanvas(1, fakeCanvas, 1.0);

    // Concurrently trigger second render on the same canvas
    const secondRenderPromise = viewer.renderPageCanvas(1, fakeCanvas, 1.0);

    await Promise.all([firstRenderPromise, secondRenderPromise]);

    expect(cancelCalled).toBe(true);

    // Cancel helper for canvas and text container
    const fakeTextContainer = createFakeContainer();
    viewer.cancelPageRender(fakeCanvas, fakeTextContainer);
  });

  it('explicitly cancels in-flight canvas render tasks via cancelPageRender', async () => {
    let cancelCalled = false;
    const mockPageProxy: PdfPageProxy = {
      pageNumber: 1,
      getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale, scale }),
      getTextContent: async () => ({ items: [] }),
      render: vi.fn().mockReturnValue({
        promise: new Promise(() => {}),
        cancel: () => {
          cancelCalled = true;
        },
      }),
    };

    const mockEngine: IPdfEngine = {
      loadDocument: async () => ({
        numPages: 1,
        getPage: async () => mockPageProxy,
      }),
    };

    const viewer = new PdfViewerAdapter(mockEngine);
    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(8));

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
    } as unknown as HTMLCanvasElement;

    void viewer.renderPageCanvas(1, fakeCanvas, 1.0);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const fakeTextContainer = createFakeContainer();
    viewer.cancelPageRender(fakeCanvas, fakeTextContainer);
    expect(cancelCalled).toBe(true);
  });

  it('handles navigation boundaries, empty documents, and rendering errors', async () => {
    const errorPageProxy: PdfPageProxy = {
      pageNumber: 1,
      getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale, scale }),
      getTextContent: async () => ({ items: [] }),
      render: vi.fn().mockReturnValue({
        promise: Promise.reject(new Error('Canvas rasterization error')),
      }),
    };

    const mockEngine: IPdfEngine = {
      loadDocument: async () => ({
        numPages: 1,
        getPage: async () => errorPageProxy,
      }),
    };

    const viewer = new PdfViewerAdapter(mockEngine);
    // Boundary test before render (0 pages)
    await viewer.goToPage(1);
    expect(viewer.getPage(0)).toBeNull();
    expect(viewer.getPage(99)).toBeNull();

    const container = createFakeContainer();
    await viewer.render(container, new ArrayBuffer(8));

    // Next page at boundary does nothing
    await viewer.nextPage();
    expect(viewer.getCurrentPage().currentPage).toBe(1);

    // Prev page at boundary does nothing
    await viewer.prevPage();
    expect(viewer.getCurrentPage().currentPage).toBe(1);

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
    } as unknown as HTMLCanvasElement;

    await expect(viewer.renderPageCanvas(1, fakeCanvas, 1.0)).rejects.toThrow(
      'Canvas rasterization error'
    );
  });

  it('retrieves pages chunk on demand', async () => {
    const pageProxies: PdfPageProxy[] = Array.from({ length: 8 }, (_, idx) => ({
      pageNumber: idx + 1,
      getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale }),
      getTextContent: async () => ({
        items: [{ str: `Page ${idx + 1}` }],
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

    expect(viewer.getCurrentPage().totalPages).toBe(8);

    const chunk = viewer.getPagesChunk(6, 3);
    expect(chunk).toHaveLength(3);
    expect(chunk[0]?.pageNumber).toBe(6);
    expect(chunk[1]?.pageNumber).toBe(7);
    expect(chunk[2]?.pageNumber).toBe(8);
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
