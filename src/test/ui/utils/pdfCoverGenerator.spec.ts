import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IPdfEngine,
  PdfDocumentProxy,
  PdfPageProxy,
} from '../../../adapters/viewers/IPdfEngine';
import {
  generatePdfPageCoverDataUrl,
  renderPdfPageToDataUrl,
} from '../../../ui/utils/pdfCoverGenerator';

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
      toDataURL: vi.fn((type?: string) => {
        if (type === 'image/webp') {
          return 'data:image/webp;base64,mockWebpData';
        }
        return 'data:image/png;base64,mockPngData';
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

  it('renders page 1 to WebP data url with proper scaling', async () => {
    const dataUrl = await renderPdfPageToDataUrl(mockPage, {
      maxWidth: 300,
      canvas: fakeCanvas,
    });

    expect(dataUrl).toBe('data:image/webp;base64,mockWebpData');
    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.0 });
    // base width is 600, maxWidth 300 -> scale 0.5
    expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 0.5 });
    expect(mockPage.render).toHaveBeenCalled();
  });

  it('falls back to PNG if WebP export is not supported', async () => {
    const canvasWithFallback = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({}),
      toDataURL: vi.fn((type?: string) => {
        if (type === 'image/webp') {
          throw new Error('Unsupported format');
        }
        return 'data:image/png;base64,mockFallbackPng';
      }),
    } as unknown as HTMLCanvasElement;

    const dataUrl = await renderPdfPageToDataUrl(mockPage, { canvas: canvasWithFallback });
    expect(dataUrl).toBe('data:image/png;base64,mockFallbackPng');
  });

  it('returns null when document is undefined and no canvas is supplied', async () => {
    const result = await renderPdfPageToDataUrl(mockPage);
    expect(result).toBeNull();
  });

  it('returns null when page.render is missing or context is unavailable', async () => {
    const pageWithoutRender: PdfPageProxy = {
      pageNumber: 1,
      getViewport: () => ({ width: 100, height: 100, scale: 1 }),
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
    };

    const result = await renderPdfPageToDataUrl(pageWithoutRender, { canvas: fakeCanvas });
    expect(result).toBeNull();

    const canvasWithoutCtx = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;

    const result2 = await renderPdfPageToDataUrl(mockPage, { canvas: canvasWithoutCtx });
    expect(result2).toBeNull();
  });

  it('generates cover from source via engine and destroys doc', async () => {
    const dataUrl = await generatePdfPageCoverDataUrl('test.pdf', mockEngine, {
      maxWidth: 200,
      canvas: fakeCanvas,
    });

    expect(dataUrl).toBe('data:image/webp;base64,mockWebpData');
    expect(mockEngine.loadDocument).toHaveBeenCalledWith('test.pdf');
    expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    expect(mockDoc.destroy).toHaveBeenCalled();
  });
});
