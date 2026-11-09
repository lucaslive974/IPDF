import { safeRequestAnimationFrame, useIsomorphicLayoutEffect } from '@utils/dom';
import { type CSSProperties, useRef, useState } from 'react';

export interface UseTransitionOverlayOptions {
  /** Whether the overlay is active and visible (declarative control) */
  readonly isVisible?: boolean;
  /** Duration of the opacity fade transition in milliseconds (default: 300ms) */
  readonly durationMs?: number;
  /** Minimum time in ms the overlay must remain visible to prevent visual flashes (default: 0ms) */
  readonly minDisplayMs?: number;
  /** Callback fired once fade-out completes and the overlay unmounts from the DOM */
  readonly onExited?: () => void;
}

export interface UseTransitionOverlayReturn {
  readonly isMounted: boolean;
  readonly opacity: number;
  readonly isBlockingClicks: boolean;
  readonly style: CSSProperties;
}

export const DEFAULT_TRANSITION_DURATION_MS = 300;

/**
 * Calculates remaining delay to satisfy minDisplayMs requirement.
 */
export function computeRemainingDelay(
  mountedAt: number,
  minDisplayMs: number,
  currentTime = Date.now()
): number {
  if (minDisplayMs <= 0 || mountedAt <= 0) {
    return 0;
  }
  const elapsed = currentTime - mountedAt;
  return Math.max(0, minDisplayMs - elapsed);
}

/**
 * Pre-calculates hardware-accelerated inline CSS styles for 60fps GPU performance.
 */
export function computeTransitionStyle(
  opacity: number,
  durationMs: number,
  isMounted: boolean
): CSSProperties {
  return {
    opacity,
    transition: `opacity ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    willChange: isMounted ? 'opacity' : 'auto',
    pointerEvents: isMounted ? 'auto' : 'none',
  };
}

/**
 * Hook managing declarative mount, smooth opacity fade, anti-flicker delay, and unmount.
 */
export function useTransitionOverlay(
  options: UseTransitionOverlayOptions = {}
): UseTransitionOverlayReturn {
  const {
    isVisible = false,
    durationMs = DEFAULT_TRANSITION_DURATION_MS,
    minDisplayMs = 0,
    onExited,
  } = options;

  const [isMounted, setIsMounted] = useState(isVisible);
  const [opacity, setOpacity] = useState(isVisible ? 1 : 0);

  const mountedAtRef = useRef(isVisible ? Date.now() : 0);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useIsomorphicLayoutEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let minDisplayTimer: ReturnType<typeof setTimeout> | null = null;

    if (isVisible) {
      mountedAtRef.current = Date.now();
      setIsMounted(true);
      const raf = safeRequestAnimationFrame(() => setOpacity(1));
      if (raf === null) {
        setOpacity(1);
      }
    } else {
      const remainingDelay = computeRemainingDelay(mountedAtRef.current, minDisplayMs);

      const startFadeOut = () => {
        setOpacity(0);
        fadeTimer = setTimeout(() => {
          setIsMounted(false);
          onExitedRef.current?.();
        }, durationMs);
      };

      if (remainingDelay > 0) {
        minDisplayTimer = setTimeout(startFadeOut, remainingDelay);
      } else {
        startFadeOut();
      }
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      if (minDisplayTimer) clearTimeout(minDisplayTimer);
    };
  }, [isVisible, durationMs, minDisplayMs]);

  const style = computeTransitionStyle(opacity, durationMs, isMounted);

  return {
    isMounted,
    opacity,
    isBlockingClicks: isMounted,
    style,
  };
}
