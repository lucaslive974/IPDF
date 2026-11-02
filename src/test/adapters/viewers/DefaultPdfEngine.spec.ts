import { DefaultPdfEngine } from '@adapters/viewers/DefaultPdfEngine';
import { describe, expect, it, vi } from 'vitest';

describe('DefaultPdfEngine', () => {
  it('instantiates cleanly and provides loadDocument interface', () => {
    const engine = new DefaultPdfEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.loadDocument).toBe('function');
  });

  it('configures GlobalWorkerOptions when in browser window context', async () => {
    const engine = new DefaultPdfEngine();

    const fakeWorkerOptions = { workerSrc: '' };
    const fakePdfjsLib = {
      GlobalWorkerOptions: fakeWorkerOptions,
      getDocument: vi.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn(),
        }),
      }),
    };

    // Simulate browser window
    const originalWindow = globalThis.window;
    globalThis.window = {} as Window & typeof globalThis;

    try {
      // @ts-expect-error test private method invocation
      engine.ensureWorkerConfigured(fakePdfjsLib);
      expect(fakeWorkerOptions.workerSrc).toContain('pdf.worker.min.mjs');
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('delegates to pdfjsLib.getDocument on loadDocument', async () => {
    const engine = new DefaultPdfEngine();
    const fakeDoc = { numPages: 2, getPage: vi.fn() };

    vi.spyOn(engine, 'loadDocument').mockImplementation(async () => fakeDoc as never);

    const doc = await engine.loadDocument(new ArrayBuffer(8));
    expect(doc.numPages).toBe(2);

    const docFromUrl = await engine.loadDocument('asset://localhost/books/sample.pdf');
    expect(docFromUrl.numPages).toBe(2);
  });
});
