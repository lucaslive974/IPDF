import {
  type UseTransitionOverlayOptions,
  useTransitionOverlay,
} from '@hooks/useTransitionOverlay';
import { type ReactNode, memo } from 'react';

export interface TransitionOverlayProps extends UseTransitionOverlayOptions {
  readonly children?: ReactNode;
  readonly className?: string;
  /** Custom z-index class for overlay positioning (default: 'z-30') */
  readonly zIndexClass?: string;
  /** Test identifier attribute */
  readonly testId?: string;
}

/**
 * Hardware-accelerated full-screen or container overlay that smoothly fades in and out.
 * Maintains clicks blocked during opacity transition and cleanly unmounts from DOM upon completion.
 */
export const TransitionOverlay = memo(function TransitionOverlay({
  isVisible = false,
  durationMs,
  minDisplayMs,
  onExited,
  children,
  className = '',
  zIndexClass = 'z-30',
  testId = 'transition-overlay',
}: TransitionOverlayProps) {
  const overlay = useTransitionOverlay({
    isVisible,
    durationMs,
    minDisplayMs,
    onExited,
  });

  if (!overlay.isMounted) {
    return null;
  }

  return (
    <div
      data-testid={testId}
      aria-hidden={overlay.opacity === 0}
      className={`fixed inset-0 ${zIndexClass} ${className}`}
      style={overlay.style}
    >
      {children}
    </div>
  );
});
