import {
  calculateFocalScrollDelta,
  calculatePinchZoomRatio,
  calculateWheelZoomDelta,
  computeZoomViewportStyles,
  handleKeyboardZoomKey,
} from '@hooks/useReaderZoom';
import { describe, expect, it, vi } from 'vitest';

describe('useReaderZoom logic', () => {
  describe('calculateWheelZoomDelta', () => {
    it('zooms in on negative deltaY and clamps step', () => {
      const result = calculateWheelZoomDelta(-100);
      expect(result.direction).toBe('in');
      expect(result.step).toBe(0.25);
    });

    it('zooms out on positive deltaY and clamps min/max step', () => {
      const result = calculateWheelZoomDelta(500);
      expect(result.direction).toBe('out');
      expect(result.step).toBe(0.25);
    });

    it('enforces minimum step size of 0.04', () => {
      const result = calculateWheelZoomDelta(1);
      expect(result.step).toBe(0.04);
    });
  });

  describe('handleKeyboardZoomKey', () => {
    it('triggers increaseZoom on + or =', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('+', actions)).toBe(true);
      expect(actions.increaseZoom).toHaveBeenCalledWith(0.1);

      expect(handleKeyboardZoomKey('=', actions)).toBe(true);
      expect(actions.increaseZoom).toHaveBeenCalledTimes(2);
    });

    it('triggers decreaseZoom on - or _', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('-', actions)).toBe(true);
      expect(actions.decreaseZoom).toHaveBeenCalledWith(0.1);

      expect(handleKeyboardZoomKey('_', actions)).toBe(true);
      expect(actions.decreaseZoom).toHaveBeenCalledTimes(2);
    });

    it('resets zoom to 1.0 on 0', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('0', actions)).toBe(true);
      expect(actions.setZoomLevel).toHaveBeenCalledWith(1.0);
    });

    it('returns false for unrecognized keys', () => {
      const actions = {
        increaseZoom: vi.fn(),
        decreaseZoom: vi.fn(),
        setZoomLevel: vi.fn(),
      };

      expect(handleKeyboardZoomKey('a', actions)).toBe(false);
      expect(actions.increaseZoom).not.toHaveBeenCalled();
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

  describe('calculateFocalScrollDelta', () => {
    it('computes scroll adjustment to keep focal point stationary on zoom in', () => {
      const delta = calculateFocalScrollDelta({
        focalViewportCoord: 600,
        prevWrapperEdge: 200,
        newWrapperEdge: 0,
        prevZoom: 1.0,
        newZoom: 2.0,
      });

      expect(delta).toBe(200);
    });

    it('returns 0 when prevZoom is zero or negative', () => {
      expect(
        calculateFocalScrollDelta({
          focalViewportCoord: 400,
          prevWrapperEdge: 100,
          newWrapperEdge: 100,
          prevZoom: 0,
          newZoom: 1.5,
        })
      ).toBe(0);
    });
  });

  describe('computeZoomViewportStyles', () => {
    it('returns unscaled base styles at zoomLevel 1.0', () => {
      const { wrapperStyle, contentStyle } = computeZoomViewportStyles(true, 1.0, {
        width: 768,
        height: 2000,
      });

      expect(wrapperStyle.width).toBe('min(calc(100vw - 2rem), 48rem)');
      expect(wrapperStyle.height).toBeUndefined();
      expect(contentStyle.transform).toBeUndefined();
      expect(contentStyle.willChange).toBeUndefined();
      expect(contentStyle.transformOrigin).toBe('top left');
      expect(contentStyle.width).toBe('min(calc(100vw - 2rem), 48rem)');
    });

    it('returns GPU scale and scaled spacer dimensions when zoomed', () => {
      const { wrapperStyle, contentStyle } = computeZoomViewportStyles(false, 1.5, {
        width: 600,
        height: 1000,
      });

      expect(wrapperStyle.width).toBe('900px');
      expect(wrapperStyle.height).toBe('1500px');
      expect(contentStyle.transform).toBe('scale(1.5)');
      expect(contentStyle.willChange).toBe('transform');
      expect(contentStyle.transformOrigin).toBe('top left');
      expect(contentStyle.width).toBe('min(calc(100vw - 2rem), 42rem)');
    });
  });
});
