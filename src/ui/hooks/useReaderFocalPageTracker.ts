import { useReaderStore } from '@stores/useReaderStore';
import { type RefObject, useEffect, useRef } from 'react';

export interface ArticleRect {
  readonly pageNumber: number;
  readonly top: number;
  readonly bottom: number;
  readonly height?: number;
}

/**
 * Calculates the relative scroll ratio inside the focal page [-1.0..1.0].
 * - When allowNegative is false (e.g. for page 1 / start of book): clamped to [0.0..1.0].
 * - When allowNegative is true (e.g. for intermediate pages / page > 1): allows negative ratio
 *   down to -1.0 when the page top is below the viewport top.
 */
export function calculatePageOffsetRatio(
  top: number,
  height: number,
  viewportTop = 0,
  allowNegative = false
): number {
  if (height <= 0) return 0.0;
  const scrolledPx = viewportTop - top;
  if (!allowNegative && scrolledPx <= 0) return 0.0;
  const ratio = scrolledPx / height;
  return Math.max(allowNegative ? -1.0 : 0.0, Math.min(1.0, ratio));
}

/**
 * Pure algorithm to detect which page covers or is closest to the focal reading line.
 */
export function findFocalPageNumber(
  articles: readonly ArticleRect[],
  focalY: number
): number | null {
  if (articles.length === 0) return null;

  let activePage: number | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const article of articles) {
    if (article.top <= focalY && article.bottom >= focalY) {
      return article.pageNumber;
    }
    const dist = Math.abs(article.top - focalY);
    if (dist < closestDistance) {
      closestDistance = dist;
      activePage = article.pageNumber;
    }
  }

  return activePage;
}

export interface UseReaderFocalPageTrackerOptions {
  readonly isProgrammaticScrollRef: RefObject<boolean>;
  readonly onPageVisible: (pageNumber: number) => void;
}

/**
 * Tracks the active reading page at 60fps based on a focal reading line (35% viewport height).
 * Ignores scroll events during programmatic scrolling.
 */
export function useReaderFocalPageTracker({
  isProgrammaticScrollRef,
  onPageVisible,
}: UseReaderFocalPageTrackerOptions): void {
  const onPageVisibleRef = useRef(onPageVisible);
  onPageVisibleRef.current = onPageVisible;

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

          const elements = document.querySelectorAll<HTMLElement>('article[data-page-number]');
          if (elements.length === 0) {
            ticking = false;
            return;
          }

          const focalY = window.innerHeight * 0.35;
          const articleRects: ArticleRect[] = [];
          for (const el of elements) {
            const pageNum = Number(el.getAttribute('data-page-number'));
            if (pageNum > 0) {
              const rect = el.getBoundingClientRect();
              articleRects.push({
                pageNumber: pageNum,
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height,
              });
            }
          }

          const activePage = findFocalPageNumber(articleRects, focalY);
          if (activePage && activePage > 0) {
            onPageVisibleRef.current(activePage);

            const activeArticle = articleRects.find((a) => a.pageNumber === activePage);
            if (activeArticle) {
              const height = activeArticle.height ?? activeArticle.bottom - activeArticle.top;
              const allowNegative = activePage > 1;
              const ratio = calculatePageOffsetRatio(activeArticle.top, height, 0, allowNegative);
              const currentRatio = useReaderStore.getState().pageOffsetRatio;
              if (Math.abs(currentRatio - ratio) >= 0.001) {
                useReaderStore.getState().setPageOffsetRatio(ratio);
              }
            }
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
}
