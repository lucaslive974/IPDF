import type { Highlight } from '@domain/Highlight';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

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
  readonly isNearViewport: boolean;
}

export function usePdfPageRenderer({
  pageNumber,
  highlights,
}: UsePdfPageRendererOptions): UsePdfPageRendererReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const { pdfViewer } = useServiceContainer();

  // Only the target page and immediate neighbor start near viewport to avoid rendering avalanche
  const [isNearViewport, setIsNearViewport] = useState<boolean>(() => {
    const targetPage = useReaderStore.getState().currentPage;
    return typeof IntersectionObserver === 'undefined' || Math.abs(pageNumber - targetPage) <= 1;
  });

  // Track viewport proximity with an 800px buffer (~1 page ahead/behind)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsNearViewport(entry.isIntersecting);
        }
      },
      { rootMargin: '800px 0px' }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Only render canvas and text layer when near viewport
  useEffect(() => {
    if (!isNearViewport) {
      pdfViewer.cancelPageRender?.(canvasRef.current, textLayerRef.current);
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
      }
      return;
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let textLayerTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const container = containerRef.current;

    const markStreamReadyIfNeeded = () => {
      if (!useReaderStore.getState().isStreamReady) {
        useReaderStore.getState().setStreamReady(true);
      }
    };

    const render = async () => {
      const pageProxy = await pdfViewer.getPageProxy(pageNumber);
      if (cancelled) return;
      if (!pageProxy || !containerRef.current) {
        markStreamReadyIfNeeded();
        return;
      }

      const unscaledViewport = pageProxy.getViewport({ scale: 1.0 });

      // Lock container aspect ratio so layout never shifts when unrendered
      if (unscaledViewport.width > 0 && unscaledViewport.height > 0) {
        containerRef.current.style.aspectRatio = `${unscaledViewport.width} / ${unscaledViewport.height}`;
      }

      const scale = calculatePdfResponsiveScale(
        containerRef.current.clientWidth,
        unscaledViewport.width
      );

      if (canvasRef.current) {
        await pdfViewer.renderPageCanvas(pageNumber, canvasRef.current, scale);
      }
      if (cancelled) return;

      markStreamReadyIfNeeded();

      if (textLayerTimer) clearTimeout(textLayerTimer);
      textLayerTimer = setTimeout(() => {
        if (!cancelled && textLayerRef.current) {
          void pdfViewer.renderPageTextLayer(pageNumber, textLayerRef.current, scale);
        }
      }, 0);
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
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (textLayerTimer) clearTimeout(textLayerTimer);
      if (resizeObserver) resizeObserver.disconnect();
      pdfViewer.cancelPageRender?.(canvasRef.current, textLayerRef.current);
    };
  }, [pdfViewer, pageNumber, isNearViewport]);

  const pageNotes = useMemo(
    () => filterPageNotes(highlights, pageNumber),
    [highlights, pageNumber]
  );

  return {
    containerRef,
    canvasRef,
    textLayerRef,
    pageNotes,
    isNearViewport,
  };
}
