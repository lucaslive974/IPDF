import { useTypographyStore } from '@stores/useTypographyStore';
import { useEffect } from 'react';

export interface ZoomActions {
  readonly increaseZoom: (step: number) => void;
  readonly decreaseZoom: (step: number) => void;
  readonly setZoomLevel: (zoom: number) => void;
}

export function calculateWheelZoomDelta(deltaY: number): {
  readonly direction: 'in' | 'out';
  readonly step: number;
} {
  const delta = Math.abs(deltaY);
  const step = Math.min(0.25, Math.max(0.04, delta * 0.005));
  return {
    direction: deltaY < 0 ? 'in' : 'out',
    step,
  };
}

export function handleKeyboardZoomKey(key: string, actions: ZoomActions): boolean {
  if (key === '=' || key === '+') {
    actions.increaseZoom(0.1);
    return true;
  }
  if (key === '-' || key === '_') {
    actions.decreaseZoom(0.1);
    return true;
  }
  if (key === '0') {
    actions.setZoomLevel(1.0);
    return true;
  }
  return false;
}

export function calculatePinchZoomRatio(
  initialPinchZoom: number,
  initialPinchDistance: number,
  currentDistance: number
): number {
  if (initialPinchDistance <= 0) return initialPinchZoom;
  return initialPinchZoom * (currentDistance / initialPinchDistance);
}

/**
 * Manages desktop zoom (wheel / keyboard shortcuts) and mobile pinch-to-zoom gestures.
 */
export function useReaderZoomGestures(): void {
  const increaseZoom = useTypographyStore((s) => s.increaseZoom);
  const decreaseZoom = useTypographyStore((s) => s.decreaseZoom);
  const setZoomLevel = useTypographyStore((s) => s.setZoomLevel);

  // 1. Wheel and Keyboard Zoom Shortcuts (Ctrl/Cmd + Wheel, Ctrl/Cmd + (+/-/0))
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const { direction, step } = calculateWheelZoomDelta(e.deltaY);
        if (direction === 'in') {
          increaseZoom(step);
        } else {
          decreaseZoom(step);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (handleKeyboardZoomKey(e.key, { increaseZoom, decreaseZoom, setZoomLevel })) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [increaseZoom, decreaseZoom, setZoomLevel]);

  // 2. Pinch-to-Zoom on Mobile / Touch Devices
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
          setZoomLevel(
            calculatePinchZoomRatio(initialPinchZoom, initialPinchDistance, currentDistance)
          );
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
}
