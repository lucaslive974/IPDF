import { clamp } from '@utils/math';

export interface VirtualSpacersResult {
  readonly topSpacerHeight: number;
  readonly bottomSpacerHeight: number;
  readonly totalEstimatedHeight: number;
}

export interface CalculateVirtualSpacersOptions {
  readonly firstLoadedPage: number;
  readonly lastLoadedPage: number;
  readonly totalPages: number;
  readonly defaultPageHeight: number;
}

export function calculateVirtualSpacers({
  firstLoadedPage,
  lastLoadedPage,
  totalPages,
  defaultPageHeight,
}: CalculateVirtualSpacersOptions): VirtualSpacersResult {
  if (totalPages <= 0 || defaultPageHeight <= 0) {
    return { topSpacerHeight: 0, bottomSpacerHeight: 0, totalEstimatedHeight: 0 };
  }

  const safeFirst = clamp(firstLoadedPage, 1, totalPages);
  const safeLast = clamp(lastLoadedPage, safeFirst, totalPages);

  const topSpacerHeight = (safeFirst - 1) * defaultPageHeight;
  const bottomSpacerHeight = (totalPages - safeLast) * defaultPageHeight;

  return {
    topSpacerHeight,
    bottomSpacerHeight,
    totalEstimatedHeight: totalPages * defaultPageHeight,
  };
}

/**
 * Estimates which page number corresponds to a vertical scroll position in the document.
 */
export function estimatePageFromScrollTop(
  scrollTop: number,
  totalPages: number,
  defaultPageHeight: number
): number {
  if (defaultPageHeight <= 0) {
    return 1;
  }
  const estimated = Math.floor(scrollTop / defaultPageHeight) + 1;
  return clamp(estimated, 1, totalPages);
}
