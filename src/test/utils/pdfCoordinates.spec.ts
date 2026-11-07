import type { BoundingBox } from '@domain/types';
import {
  denormalizeBoundingBox,
  doBoxesOverlap,
  isPointInsideBox,
  normalizeBoundingBox,
  normalizeSelectionRects,
} from '@utils/pdfCoordinates';
import { describe, expect, it } from 'vitest';

describe('pdfCoordinates utilities', () => {
  describe('normalizeBoundingBox', () => {
    it('normalizes client rect coordinates relative to page rect', () => {
      const pageRect = { left: 100, top: 200, width: 800, height: 1000 };
      const clientRect = { left: 180, top: 300, width: 400, height: 50 };

      const normalized = normalizeBoundingBox(clientRect, pageRect);

      expect(normalized.x).toBeCloseTo(0.1, 5);
      expect(normalized.y).toBeCloseTo(0.1, 5);
      expect(normalized.width).toBeCloseTo(0.5, 5);
      expect(normalized.height).toBeCloseTo(0.05, 5);
    });

    it('clamps coordinates when client rect extends outside page rect', () => {
      const pageRect = { left: 100, top: 100, width: 500, height: 500 };
      const clientRect = { left: 50, top: 50, width: 600, height: 600 };

      const normalized = normalizeBoundingBox(clientRect, pageRect);

      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
      expect(normalized.width).toBe(1);
      expect(normalized.height).toBe(1);
    });

    it('returns zero box safely when pageRect width or height is zero', () => {
      const pageRect = { left: 0, top: 0, width: 0, height: 0 };
      const clientRect = { left: 10, top: 10, width: 100, height: 50 };

      const normalized = normalizeBoundingBox(clientRect, pageRect);

      expect(normalized).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe('denormalizeBoundingBox', () => {
    it('converts normalized box back to screen pixels', () => {
      const pageRect = { left: 100, top: 200, width: 800, height: 1000 };
      const box: BoundingBox = { x: 0.1, y: 0.25, width: 0.5, height: 0.1 };

      const denormalized = denormalizeBoundingBox(box, pageRect);

      expect(denormalized.left).toBeCloseTo(180, 5);
      expect(denormalized.top).toBeCloseTo(450, 5);
      expect(denormalized.width).toBeCloseTo(400, 5);
      expect(denormalized.height).toBeCloseTo(100, 5);
      expect(denormalized.right).toBeCloseTo(580, 5);
      expect(denormalized.bottom).toBeCloseTo(550, 5);
    });
  });

  describe('normalizeSelectionRects', () => {
    it('normalizes valid client rects from Range and filters out zero-sized rects', () => {
      const mockPageElement = {
        getBoundingClientRect: () => ({
          left: 100,
          top: 100,
          width: 500,
          height: 1000,
          right: 600,
          bottom: 1100,
        }),
      };

      const mockRange = {
        getClientRects: () =>
          [
            { left: 150, top: 150, width: 250, height: 20, right: 400, bottom: 170 },
            { left: 150, top: 170, width: 0, height: 0, right: 150, bottom: 170 }, // zero-sized
            { left: 150, top: 180, width: 200, height: 20, right: 350, bottom: 200 },
          ] as unknown as DOMRectList,
      };

      const rects = normalizeSelectionRects(mockRange, mockPageElement as unknown as HTMLElement);

      expect(rects).toHaveLength(2);
      expect(rects[0].x).toBeCloseTo(0.1, 5);
      expect(rects[0].y).toBeCloseTo(0.05, 5);
      expect(rects[0].width).toBeCloseTo(0.5, 5);
      expect(rects[0].height).toBeCloseTo(0.02, 5);

      expect(rects[1].x).toBeCloseTo(0.1, 5);
      expect(rects[1].y).toBeCloseTo(0.08, 5);
      expect(rects[1].width).toBeCloseTo(0.4, 5);
      expect(rects[1].height).toBeCloseTo(0.02, 5);
    });

    it('returns empty array when range has no client rects', () => {
      const mockPageElement = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 500,
          height: 500,
          right: 500,
          bottom: 500,
        }),
      };

      const mockRange = {
        getClientRects: () => [] as unknown as DOMRectList,
      };

      const rects = normalizeSelectionRects(mockRange, mockPageElement as unknown as HTMLElement);
      expect(rects).toEqual([]);
    });
  });

  describe('isPointInsideBox', () => {
    const box: BoundingBox = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };

    it('returns true when normalized point is strictly inside', () => {
      expect(isPointInsideBox(0.3, 0.4, box)).toBe(true);
    });

    it('returns true when normalized point is on boundary', () => {
      expect(isPointInsideBox(0.2, 0.3, box)).toBe(true);
      expect(isPointInsideBox(0.6, 0.5, box)).toBe(true);
    });

    it('returns false when normalized point is outside', () => {
      expect(isPointInsideBox(0.1, 0.4, box)).toBe(false);
      expect(isPointInsideBox(0.7, 0.4, box)).toBe(false);
      expect(isPointInsideBox(0.3, 0.2, box)).toBe(false);
      expect(isPointInsideBox(0.3, 0.6, box)).toBe(false);
    });
  });

  describe('doBoxesOverlap', () => {
    it('detects intersecting bounding boxes', () => {
      const a: BoundingBox = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };
      const b: BoundingBox = { x: 0.2, y: 0.15, width: 0.3, height: 0.2 };

      expect(doBoxesOverlap(a, b)).toBe(true);
      expect(doBoxesOverlap(b, a)).toBe(true);
    });

    it('returns false when bounding boxes do not intersect', () => {
      const a: BoundingBox = { x: 0.1, y: 0.1, width: 0.1, height: 0.1 };
      const b: BoundingBox = { x: 0.5, y: 0.5, width: 0.1, height: 0.1 };

      expect(doBoxesOverlap(a, b)).toBe(false);
    });
  });
});
