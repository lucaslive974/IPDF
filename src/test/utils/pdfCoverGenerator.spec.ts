import type { IPdfEngine, PdfDocumentProxy, PdfPageProxy } from '@ports/IPdfEngine';
import { generatePdfPageCoverPayload, renderPdfPageToCoverPayload } from '@utils/pdfCoverGenerator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createMockBlob(bytes: number[], type: string): Blob {
  const buffer = new Uint8Array(bytes).buffer;
  return {
    size: bytes.length,
    type,
    arrayBuffer: async () => buffer,
  } as unknown as Blob;
}

describe('pdfCoverGenerator', () => {
  let mockPage: PdfPageProxy;
  let mockDoc: PdfDocumentProxy;
  let mockEngine: IPdfEngine;
  let fakeCanvas: HTMLCanvasElement;

  beforeEach(() => {
    fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        fillRect: vi.fn(),
      }),
      toBlob: vi.fn((cb: (blob: Blob | null) => void, type?: string) => {
        if (type === 'image/webp') {
          cb(createMockBlob([1, 2, 3], 'image/webp'));
          return;
        }
        cb(createMockBlob([4, 5, 6], 'image/png'));
      }),
    } as unknown as HTMLCanvasElement;

    mockPage = {
      pageNumber: 1,
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale,
      })),
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      render: vi.fn().mockReturnValue({
        promise: Promise.resolve(),
      }),
    };

    mockDoc = {
      numPages: 10,
      getPage: vi.fn().mockResolvedValue(mockPage),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    mockEngine = {
      loadDocument: vi.fn().mockResolvedValue(mockDoc),
    };
  });

  it('renders page 1 to WebP binary payload with proper scaling', async () => {
    const payload = await renderPdfPageToCoverPayload(mockPage, {
      maxWidth: 300,
      canvas: fakeCanvas,
    });

    expect(payload).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/webp',
    });
    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.0 });
    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 0.5 });
    expect(mockPage.render).toHaveBeenCalled();
  });

  it('falls back to PNG if WebP export is not supported', async () => {
    const canvasWithFallback = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
      toBlob: vi.fn((cb: (blob: Blob | null) => void, type?: string) => {
        if (type === 'image/webp') {
          throw new Error('Unsupported format');
        }
        cb(createMockBlob([7, 8, 9], 'image/png'));
      }),
    } as unknown as HTMLCanvasElement;

    const payload = await renderPdfPageToCoverPayload(mockPage, { canvas: canvasWithFallback });
    expect(payload).toEqual({
      bytes: new Uint8Array([7, 8, 9]),
      mimeType: 'image/png',
    });
  });

  it('returns null when document is undefined and no canvas is supplied', async () => {
    const result = await renderPdfPageToCoverPayload(mockPage);
    expect(result).toBeNull();
  });

  it('returns null when page.render is missing or context is unavailable', async () => {
    const pageWithoutRender: PdfPageProxy = {
      pageNumber: 1,
      getViewport: () => ({ width: 100, height: 100, scale: 1 }),
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
    };

    const result = await renderPdfPageToCoverPayload(pageWithoutRender, { canvas: fakeCanvas });
    expect(result).toBeNull();

    const canvasWithoutCtx = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;

    const result2 = await renderPdfPageToCoverPayload(mockPage, { canvas: canvasWithoutCtx });
    expect(result2).toBeNull();
  });

  it('generates cover from source via engine and destroys doc', async () => {
    const rangeSource = {
      totalBytes: 64,
      readRange: vi.fn().mockResolvedValue(new Uint8Array(64)),
    };
    const payload = await generatePdfPageCoverPayload(rangeSource, mockEngine, {
      maxWidth: 200,
      canvas: fakeCanvas,
    });

    expect(payload).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/webp',
    });
    expect(mockEngine.loadDocument).toHaveBeenCalledWith(rangeSource);
    expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    expect(mockDoc.destroy).toHaveBeenCalled();
  });
});
