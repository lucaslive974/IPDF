import type { BoundingBox } from '@domain/types';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DenormalizedRect extends RectLike {
  right: number;
  bottom: number;
}

/**
 * Normalizes physical client coordinates into relative percentage coordinates (0.0 to 1.0)
 * clamped within the bounding rectangle of the target page element.
 */
export function normalizeBoundingBox(clientRect: RectLike, pageRect: RectLike): BoundingBox {
  if (pageRect.width <= 0 || pageRect.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const clampedLeft = Math.max(pageRect.left, clientRect.left);
  const clampedRight = Math.min(pageRect.left + pageRect.width, clientRect.left + clientRect.width);
  const clampedTop = Math.max(pageRect.top, clientRect.top);
  const clampedBottom = Math.min(
    pageRect.top + pageRect.height,
    clientRect.top + clientRect.height
  );

  if (clampedRight <= clampedLeft || clampedBottom <= clampedTop) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: (clampedLeft - pageRect.left) / pageRect.width,
    y: (clampedTop - pageRect.top) / pageRect.height,
    width: (clampedRight - clampedLeft) / pageRect.width,
    height: (clampedBottom - clampedTop) / pageRect.height,
  };
}

/**
 * Denormalizes relative (0.0 to 1.0) coordinates back into physical screen pixel positions
 * based on the current page bounding rectangle.
 */
export function denormalizeBoundingBox(box: BoundingBox, pageRect: RectLike): DenormalizedRect {
  const left = pageRect.left + box.x * pageRect.width;
  const top = pageRect.top + box.y * pageRect.height;
  const width = box.width * pageRect.width;
  const height = box.height * pageRect.height;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

/**
 * Extracts and normalizes all client bounding rects of an active text selection Range
 * relative to the containing page element.
 */
export function normalizeSelectionRects(
  range: Pick<Range, 'getClientRects'>,
  pageElement: Pick<HTMLElement, 'getBoundingClientRect'>
): BoundingBox[] {
  const pageRect = pageElement.getBoundingClientRect();
  const rawRects = Array.from(range.getClientRects());

  const result: BoundingBox[] = [];

  for (const rect of rawRects) {
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    const box = normalizeBoundingBox(rect, pageRect);
    if (box.width > 0 && box.height > 0) {
      result.push(box);
    }
  }

  return result;
}

/**
 * Checks whether a normalized point (x, y in 0.0..1.0 range) is inside a bounding box.
 */
export function isPointInsideBox(x: number, y: number, box: BoundingBox): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/**
 * Checks whether two bounding boxes intersect using Axis-Aligned Bounding Box (AABB) collision test.
 */
export function doBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
