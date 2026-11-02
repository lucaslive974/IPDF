import { DefaultPdfEngine } from '../../adapters/viewers/DefaultPdfEngine';
import type { IPdfEngine, PdfPageProxy } from '../../adapters/viewers/IPdfEngine';

export interface RenderCoverOptions {
  readonly maxWidth?: number;
  readonly quality?: number;
  readonly canvas?: HTMLCanvasElement;
}

/**
 * Renders page 1 of a PDF proxy onto an off-screen canvas and returns an image Data URL.
 * Defaults to WebP format with fallback to PNG.
 */
export async function renderPdfPageToDataUrl(
  page: PdfPageProxy,
  options?: RenderCoverOptions
): Promise<string | null> {
  let canvas = options?.canvas;
  if (!canvas) {
    if (typeof document === 'undefined') {
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
    const webpUrl = canvas.toDataURL('image/webp', quality);
    if (webpUrl?.startsWith('data:image/webp')) {
      return webpUrl;
    }
  } catch {
    // Fallback if image/webp export is not supported in environment
  }

  return canvas.toDataURL('image/png');
}

/**
 * Loads a PDF document from binary or URL source, extracts page 1,
 * and renders it as a cover thumbnail Data URL.
 */
export async function generatePdfPageCoverDataUrl(
  source: ArrayBuffer | string,
  engine: IPdfEngine = new DefaultPdfEngine(),
  options?: RenderCoverOptions
): Promise<string | null> {
  const doc = await engine.loadDocument(source);
  try {
    const page = await doc.getPage(1);
    return await renderPdfPageToDataUrl(page, options);
  } finally {
    if (doc.destroy) {
      await doc.destroy();
    }
  }
}
