import { type RefObject, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import type { DocumentPage } from '../../../core/ports/BackendService';
import { useReader } from '../../hooks/useReader';
import { useReaderUI } from '../../hooks/useReaderUI';
import { useTypographyStore } from '../../stores/useTypographyStore';
import { ReaderPageItem } from './ReaderPageItem';

export interface ReaderStreamProps {
  readonly isProgrammaticScrollRef: RefObject<boolean>;
}

export const ReaderStream = memo(function ReaderStream({
  isProgrammaticScrollRef,
}: ReaderStreamProps) {
  const reader = useReader();
  const { setContextMenu, openHighlightPopover } = useReaderUI();

  const increaseZoom = useTypographyStore((s) => s.increaseZoom);
  const decreaseZoom = useTypographyStore((s) => s.decreaseZoom);
  const setZoomLevel = useTypographyStore((s) => s.setZoomLevel);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  const onPageVisibleRef = useRef(reader.onPageVisible);
  onPageVisibleRef.current = reader.onPageVisible;

  // Strict ascending order and deduplication of pages
  const sortedPages = useMemo(() => {
    const pageMap = new Map<number, DocumentPage>();
    for (const p of reader.loadedPages) {
      pageMap.set(p.pageNumber, p);
    }
    return Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [reader.loadedPages]);

  // 1. Right Click Context Menu (Dropdown) Handler
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const text = selection.toString().trim();
      if (text.length === 0) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const article = target?.closest('article[data-page-number]');
      const pageNumber = article
        ? Number(article.getAttribute('data-page-number'))
        : reader.currentPage;

      e.preventDefault();
      setContextMenu({
        text,
        x: e.clientX,
        y: e.clientY,
        pageNumber: pageNumber || reader.currentPage,
      });
    };

    const container = contentAreaRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [reader.currentPage, setContextMenu]);

  // 2. Ctrl + Scroll / Cmd + Scroll to Zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          increaseZoom(0.04);
        } else {
          decreaseZoom(0.04);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [increaseZoom, decreaseZoom]);

  // 3. Pinch-to-Zoom on Mobile / Touch Devices
  useEffect(() => {
    let initialPinchDistance: number | null = null;
    let initialPinchZoom = 1.0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        if (t1 && t2) {
          initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          initialPinchZoom = useTypographyStore.getState().zoomLevel;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance !== null && initialPinchDistance > 0) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        if (t1 && t2) {
          e.preventDefault();
          const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const ratio = currentDistance / initialPinchDistance;
          setZoomLevel(initialPinchZoom * ratio);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDistance = null;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setZoomLevel]);

  // 4. Infinite Scroll Sentinel Observer (Loads 5 pages ahead on demand)
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void reader.loadMorePages('next');
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [reader]);

  // Top Sentinel for upward infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && reader.currentPage > 1) {
          void reader.loadMorePages('prev');
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [reader]);

  // 5. Dynamic Page Focal Tracker (Tracks active page at 60fps based on reading line)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isProgrammaticScrollRef.current) {
            ticking = false;
            return;
          }

          const articles = document.querySelectorAll<HTMLElement>('article[data-page-number]');
          if (articles.length === 0) {
            ticking = false;
            return;
          }

          const focalY = window.innerHeight * 0.35;
          let activePage: number | null = null;
          let closestDistance = Number.POSITIVE_INFINITY;

          for (const article of articles) {
            const rect = article.getBoundingClientRect();
            if (rect.top <= focalY && rect.bottom >= focalY) {
              activePage = Number(article.getAttribute('data-page-number'));
              break;
            }
            const dist = Math.abs(rect.top - focalY);
            if (dist < closestDistance) {
              closestDistance = dist;
              activePage = Number(article.getAttribute('data-page-number'));
            }
          }

          if (activePage && activePage > 0) {
            onPageVisibleRef.current(activePage);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isProgrammaticScrollRef]);

  const handleHighlightClick = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      openHighlightPopover(highlight, coords);
    },
    [openHighlightPopover]
  );

  const handleHighlightContextMenu = useCallback(
    (e: React.MouseEvent, text: string, pageNumber: number) => {
      setContextMenu({
        text,
        x: e.clientX,
        y: e.clientY,
        pageNumber,
      });
    },
    [setContextMenu]
  );

  return (
    <main className="flex-1 w-full flex flex-col items-center px-4 sm:px-12 py-12 sm:py-20">
      <div ref={contentAreaRef} className="w-full max-w-2xl flex flex-col gap-12">
        {/* Top sentinel for reverse scrolling */}
        <div ref={topSentinelRef} className="h-4 w-full pointer-events-none" />

        {/* Render loaded pages seamlessly in continuous streaming scroll */}
        {sortedPages.map((page) => (
          <ReaderPageItem
            key={`page-${page.pageNumber}`}
            page={page}
            totalPages={reader.totalPages}
            bookTitle={reader.document.bookTitle}
            bookAuthor={reader.document.bookAuthor}
            coverImageUrl={reader.document.coverImageUrl}
            highlights={reader.getHighlightsForPage(page.pageNumber)}
            onHighlightClick={handleHighlightClick}
            onHighlightContextMenu={handleHighlightContextMenu}
          />
        ))}

        {/* Bottom sentinel: triggers next 5 pages on demand before reaching bottom */}
        <div ref={bottomSentinelRef} className="h-16 w-full flex items-center justify-center">
          {reader.currentPage < reader.totalPages && (
            <span className="text-xs text-tx-faint animate-pulse">Loading next pages...</span>
          )}
        </div>
      </div>
    </main>
  );
});
