/**
 * Page window descriptor for chunked page loading and virtualization in reader streams.
 */
export interface PageWindow {
  readonly startPage: number;
  readonly count: number;
}

export const INITIAL_BACKWARD_PAGES = 5;
export const INITIAL_ACTIVE_PAGES = 5;
export const INITIAL_FORWARD_PAGES = 5;

/**
 * Calculates a window of pages centered around targetPage, with forward and backward buffers.
 * If totalPages is provided, the window and bounds are clamped within [1, totalPages].
 */
export function calculatePageWindow(targetPage: number, totalPages?: number): PageWindow {
  const clampedTarget =
    totalPages !== undefined && totalPages > 0
      ? Math.min(Math.max(1, targetPage), totalPages)
      : Math.max(1, targetPage);

  const backwardMargin =
    clampedTarget > 1 ? Math.min(INITIAL_BACKWARD_PAGES, clampedTarget - 1) : 0;
  const startPage = Math.max(1, clampedTarget - backwardMargin);
  const windowSize = backwardMargin + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES;
  const count =
    totalPages !== undefined && totalPages > 0
      ? Math.min(windowSize, Math.max(0, totalPages - startPage + 1))
      : windowSize;

  return { startPage, count };
}
