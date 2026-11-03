import type { Highlight } from '@domain/Highlight';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { type RefObject, useEffect, useMemo, useRef } from 'react';

export function calculatePdfResponsiveScale(
  containerWidth: number,
  unscaledViewportWidth: number
): number {
  if (unscaledViewportWidth <= 0) return 1.5;
  const width = containerWidth > 0 ? containerWidth : 768;
  return width / unscaledViewportWidth;
}

export function filterPageNotes(
  highlights: readonly Highlight[],
  pageNumber: number
): readonly Highlight[] {
  return highlights.filter(
    (hl) => hl.anchor.pageNumber === pageNumber && Boolean(hl.note && hl.note.trim().length > 0)
  );
}

export interface UsePdfPageRendererOptions {
  readonly pageNumber: number;
  readonly highlights: readonly Highlight[];
}

export interface UsePdfPageRendererReturn {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly textLayerRef: RefObject<HTMLDivElement | null>;
  readonly pageNotes: readonly Highlight[];
}

export function usePdfPageRenderer({
  pageNumber,
  highlights,
}: UsePdfPageRendererOptions): UsePdfPageRendererReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const { pdfViewer } = useServiceContainer();

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const container = containerRef.current;

    const render = async () => {
      const pageProxy = await pdfViewer.getPageProxy(pageNumber);
      if (!pageProxy || !containerRef.current) return;

      const unscaledViewport = pageProxy.getViewport({ scale: 1.0 });
      const scale = calculatePdfResponsiveScale(
        containerRef.current.clientWidth,
        unscaledViewport.width
      );

      if (canvasRef.current) {
        await pdfViewer.renderPageCanvas(pageNumber, canvasRef.current, scale);
      }
      if (textLayerRef.current) {
        await pdfViewer.renderPageTextLayer(pageNumber, textLayerRef.current, scale);
      }
    };

    void render();

    // Re-align on container resize or zoom level changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect && entry.contentRect.width > 0) {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => void render(), 100);
          }
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      pdfViewer.cancelPageRender?.(canvasRef.current, textLayerRef.current);
    };
  }, [pdfViewer, pageNumber]);

  const pageNotes = useMemo(
    () => filterPageNotes(highlights, pageNumber),
    [highlights, pageNumber]
  );

  return {
    containerRef,
    canvasRef,
    textLayerRef,
    pageNotes,
  };
}
