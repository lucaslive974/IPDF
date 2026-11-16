import { DefaultPdfEngine } from '@adapters/viewers/DefaultPdfEngine';
import type { ILibraryService } from '@ports/ILibraryService';
import type { IPdfEngine, PdfPageProxy, PdfRangeSource } from '@ports/IPdfEngine';
import type { IReaderService } from '@ports/IReaderService';
import { hasDocument } from '@utils/dom';
import { appLogger } from '@utils/logger';

export interface RenderCoverOptions {
  readonly maxWidth?: number;
  readonly quality?: number;
  readonly canvas?: HTMLCanvasElement;
}

export interface CoverBinaryPayload {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

async function canvasToCoverPayload(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<CoverBinaryPayload | null> {
  if (typeof canvas.toBlob !== 'function') {
    return null;
  }
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, quality);
  });
  if (!blob || blob.size === 0 || (mimeType === 'image/webp' && blob.type !== 'image/webp')) {
    return null;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return bytes.length > 0 ? { bytes, mimeType: blob.type || mimeType } : null;
}

/**
 * Renders page 1 of a PDF proxy onto an off-screen canvas and returns binary image bytes + MIME type.
 * Defaults to WebP format with fallback to PNG.
 */
export async function renderPdfPageToCoverPayload(
  page: PdfPageProxy,
  options?: RenderCoverOptions
): Promise<CoverBinaryPayload | null> {
  let canvas = options?.canvas;
  if (!canvas) {
    if (!hasDocument()) {
      return null;
    }
    canvas = document.createElement('canvas');
  }

  const maxWidth = options?.maxWidth ?? 360;
  const quality = options?.quality ?? 0.85;

  const baseViewport = page.getViewport({ scale: 1.0 });
  const scale = maxWidth / Math.max(baseViewport.width, 1);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = canvas.getContext('2d');
  if (!ctx || !page.render) {
    return null;
  }

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
  });

  await renderTask.promise;

  try {
    const webp = await canvasToCoverPayload(canvas, 'image/webp', quality);
    if (webp) {
      return webp;
    }
  } catch (err) {
    appLogger.warn(
      `WebP cover encoding unsupported or failed; falling back to PNG: ${String(err)}`,
      'cover'
    );
  }

  return canvasToCoverPayload(canvas, 'image/png');
}

/**
 * Loads a PDF document from binary or URL source, extracts page 1,
 * and renders it as a binary cover thumbnail payload.
 */
export async function generatePdfPageCoverPayload(
  source: PdfRangeSource,
  engine: IPdfEngine = new DefaultPdfEngine(),
  options?: RenderCoverOptions
): Promise<CoverBinaryPayload | null> {
  const doc = await engine.loadDocument(source);
  try {
    const page = await doc.getPage(1);
    return await renderPdfPageToCoverPayload(page, options);
  } finally {
    if (doc.destroy) {
      await doc.destroy();
    }
  }
}

function waitForIdleFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (
        window as Window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback(() => resolve(), { timeout: 200 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Generates page-1 thumbnail bytes for a PDF book on idle and persists them via ILibraryService.
 */
export async function generateAndSavePdfCover(
  bookHash: string,
  libraryService: ILibraryService,
  readerService: IReaderService
): Promise<CoverBinaryPayload | null> {
  await waitForIdleFrame();
  const totalBytes = await readerService.getBookFileSize(bookHash);
  const payload = await generatePdfPageCoverPayload({
    totalBytes,
    readRange: (begin: number, end: number) => readerService.readBookRange(bookHash, begin, end),
  });
  if (!payload) {
    return null;
  }
  await libraryService.saveBookCover(bookHash, payload.bytes, payload.mimeType);
  return payload;
}
