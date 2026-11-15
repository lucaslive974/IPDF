import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { hasResizeObserver, hasWindow, safeScrollBy, useIsomorphicLayoutEffect } from '@utils/dom';
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ZoomActions {
  readonly increaseZoom: (step: number) => void;
  readonly decreaseZoom: (step: number) => void;
  readonly setZoomLevel: (zoom: number) => void;
}

export interface ZoomFocalPoint {
  readonly clientX: number;
  readonly clientY: number;
}

export interface FocalScrollAdjustmentInput {
  readonly focalViewportCoord: number;
  readonly prevWrapperEdge: number;
  readonly newWrapperEdge: number;
  readonly prevZoom: number;
  readonly newZoom: number;
}

export interface ZoomViewportDimensions {
  readonly width: number;
  readonly height: number;
}

export interface UseReaderZoomOptions {
  readonly isPdf: boolean;
  readonly contentAreaRef: RefObject<HTMLDivElement | null>;
}

export interface UseReaderZoomReturn {
  readonly mainRef: RefObject<HTMLElement | null>;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
  readonly wrapperStyle: CSSProperties;
  readonly contentStyle: CSSProperties;
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
 * Computes the scroll delta required along a single axis so the document point
 * under the pointer or pinch midpoint stays stationary after GPU zoom scaling.
 */
export function calculateFocalScrollDelta({
  focalViewportCoord,
  prevWrapperEdge,
  newWrapperEdge,
  prevZoom,
  newZoom,
}: FocalScrollAdjustmentInput): number {
  if (prevZoom <= 0) return 0;
  const contentCoord = (focalViewportCoord - prevWrapperEdge) / prevZoom;
  const projectedScreenCoord = newWrapperEdge + contentCoord * newZoom;
  return projectedScreenCoord - focalViewportCoord;
}

/**
 * Pure helper computing the outer scroll-spacer style and GPU-scaled content style.
 */
export function computeZoomViewportStyles(
  isPdf: boolean,
  zoomLevel: number,
  baseSize: ZoomViewportDimensions
): { readonly wrapperStyle: CSSProperties; readonly contentStyle: CSSProperties } {
  const baseWidthCss = isPdf ? 'min(calc(100vw - 2rem), 48rem)' : 'min(calc(100vw - 2rem), 42rem)';
  const isScaled = zoomLevel !== 1;

  const wrapperStyle: CSSProperties = {
    width: isScaled && baseSize.width > 0 ? `${baseSize.width * zoomLevel}px` : baseWidthCss,
    height: isScaled && baseSize.height > 0 ? `${baseSize.height * zoomLevel}px` : undefined,
  };

  const contentStyle: CSSProperties = {
    transform: isScaled ? `scale(${zoomLevel})` : undefined,
    transformOrigin: 'top left',
    willChange: isScaled ? 'transform' : undefined,
    width: baseWidthCss,
  };

  return { wrapperStyle, contentStyle };
}

/**
 * Unified ViewModel hook managing GPU-composited reader zoom:
 * per-book 100% reset, wheel/keyboard/pinch gestures, unscaled base-size tracking,
 * scroll-spacer dimensions, and focal-point scroll compensation.
 */
export function useReaderZoom({
  isPdf,
  contentAreaRef,
}: UseReaderZoomOptions): UseReaderZoomReturn {
  const bookHash = useReaderStore((s) => s.document.bookHash);
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);
  const increaseZoom = useTypographyStore((s) => s.increaseZoom);
  const decreaseZoom = useTypographyStore((s) => s.decreaseZoom);
  const setZoomLevel = useTypographyStore((s) => s.setZoomLevel);

  const mainRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [baseSize, setBaseSize] = useState<ZoomViewportDimensions>({
    width: 0,
    height: 0,
  });

  const prevZoomRef = useRef(zoomLevel);
  const pendingFocalRef = useRef<ZoomFocalPoint | null>(null);
  const prevWrapperRectRef = useRef<{ left: number; top: number } | null>(null);

  // Always start every book session at 100% zoom
  useEffect(() => {
    if (bookHash) {
      setZoomLevel(1.0);
    }
  }, [bookHash, setZoomLevel]);

  // Track unscaled content dimensions so outer wrapper can size scrollbars without inner reflow
  useEffect(() => {
    const contentEl = contentAreaRef.current;
    if (!contentEl || !hasResizeObserver()) {
      return;
    }

    const updateBaseSize = () => {
      const width = contentEl.offsetWidth;
      const height = contentEl.offsetHeight;
      setBaseSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    updateBaseSize();
    const observer = new ResizeObserver(updateBaseSize);
    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [contentAreaRef]);

  const captureFocalPoint = useCallback((focalPoint: ZoomFocalPoint) => {
    pendingFocalRef.current = focalPoint;
    if (!prevWrapperRectRef.current && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      prevWrapperRectRef.current = { left: rect.left, top: rect.top };
    }
  }, []);

  // Desktop wheel and keyboard zoom shortcuts (Ctrl/Cmd + Wheel, Ctrl/Cmd + (+/-/0))
  useEffect(() => {
    if (!hasWindow()) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        captureFocalPoint({ clientX: e.clientX, clientY: e.clientY });
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
  }, [increaseZoom, decreaseZoom, setZoomLevel, captureFocalPoint]);

  // Mobile pinch-to-zoom gestures
  useEffect(() => {
    if (!hasWindow()) return;

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
          captureFocalPoint({
            clientX: (t1.clientX + t2.clientX) / 2,
            clientY: (t1.clientY + t2.clientY) / 2,
          });
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
  }, [setZoomLevel, captureFocalPoint]);

  // Keep the document point under the pointer/pinch stationary after GPU zoom scaling
  useIsomorphicLayoutEffect(() => {
    const prevZoom = prevZoomRef.current;
    prevZoomRef.current = zoomLevel;

    const focal = pendingFocalRef.current;
    const prevRect = prevWrapperRectRef.current;
    pendingFocalRef.current = null;
    prevWrapperRectRef.current = null;

    if (prevZoom === zoomLevel || !focal || !prevRect || !wrapperRef.current) {
      return;
    }

    const newRect = wrapperRef.current.getBoundingClientRect();
    const deltaX = calculateFocalScrollDelta({
      focalViewportCoord: focal.clientX,
      prevWrapperEdge: prevRect.left,
      newWrapperEdge: newRect.left,
      prevZoom,
      newZoom: zoomLevel,
    });
    const deltaY = calculateFocalScrollDelta({
      focalViewportCoord: focal.clientY,
      prevWrapperEdge: prevRect.top,
      newWrapperEdge: newRect.top,
      prevZoom,
      newZoom: zoomLevel,
    });

    if (mainRef.current && Math.abs(deltaX) > 0.5) {
      mainRef.current.scrollLeft += deltaX;
    }
    if (Math.abs(deltaY) > 0.5) {
      safeScrollBy(0, deltaY);
    }
  }, [zoomLevel]);

  const { wrapperStyle, contentStyle } = useMemo(
    () => computeZoomViewportStyles(isPdf, zoomLevel, baseSize),
    [isPdf, zoomLevel, baseSize]
  );

  return {
    mainRef,
    wrapperRef,
    wrapperStyle,
    contentStyle,
  };
}
