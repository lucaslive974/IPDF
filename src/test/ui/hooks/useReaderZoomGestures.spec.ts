import {
  calculatePinchZoomRatio,
  calculateWheelZoomDelta,
  handleKeyboardZoomKey,
} from '@hooks/useReaderZoomGestures';
import { describe, expect, it, vi } from 'vitest';

describe('useReaderZoomGestures logic', () => {
  describe('calculateWheelZoomDelta', () => {
    it('detects zoom in for negative deltaY and bounds step', () => {
      const result = calculateWheelZoomDelta(-100);
      expect(result.direction).toBe('in');
      expect(result.step).toBeGreaterThanOrEqual(0.04);
      expect(result.step).toBeLessThanOrEqual(0.25);
    });

    it('detects zoom out for positive deltaY and bounds step', () => {
      const result = calculateWheelZoomDelta(500);
      expect(result.direction).toBe('out');
      expect(result.step).toBe(0.25); // Clamped to maximum 0.25
    });

    it('clamps minimum step for very small scroll movements', () => {
      const result = calculateWheelZoomDelta(1);
      expect(result.step).toBe(0.04);
    });
  });

  describe('handleKeyboardZoomKey', () => {
    it('increases zoom on + or =', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('+', actions)).toBe(true);
      expect(actions.increaseZoom).toHaveBeenCalledWith(0.1);

      expect(handleKeyboardZoomKey('=', actions)).toBe(true);
      expect(actions.increaseZoom).toHaveBeenCalledWith(0.1);
    });

    it('decreases zoom on - or _', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('-', actions)).toBe(true);
      expect(actions.decreaseZoom).toHaveBeenCalledWith(0.1);

      expect(handleKeyboardZoomKey('_', actions)).toBe(true);
      expect(actions.decreaseZoom).toHaveBeenCalledWith(0.1);
    });

    it('resets zoom on 0', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('0', actions)).toBe(true);
      expect(actions.setZoomLevel).toHaveBeenCalledWith(1.0);
    });

    it('returns false for unrelated keys', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('a', actions)).toBe(false);
      expect(actions.increaseZoom).not.toHaveBeenCalled();
      expect(actions.decreaseZoom).not.toHaveBeenCalled();
    });
  });

  describe('calculatePinchZoomRatio', () => {
    it('scales zoom level proportionally to finger distance ratio', () => {
      const zoom = calculatePinchZoomRatio(1.0, 100, 200);
      expect(zoom).toBe(2.0);

      const zoomIn = calculatePinchZoomRatio(1.5, 200, 100);
      expect(zoomIn).toBe(0.75);
    });

    it('returns initial zoom if initial distance is zero or negative', () => {
      expect(calculatePinchZoomRatio(1.2, 0, 100)).toBe(1.2);
      expect(calculatePinchZoomRatio(1.2, -10, 100)).toBe(1.2);
    });
  });
});
