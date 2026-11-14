import { ThemeContext, type ThemeMode } from '@providers/ThemeContext';
import { mountBookWebglScene } from '@utils/bookWebglRenderer';
import { useIsomorphicLayoutEffect } from '@utils/dom';
import { memo, useContext, useRef } from 'react';
import { Button } from './Button';

export type LoadingSplashStatus = 'loading' | 'ready' | 'error';

export interface LoadingSplashProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly message?: string;
  readonly status?: LoadingSplashStatus;
  readonly error?: string | null;
  readonly theme?: ThemeMode;
  readonly onRetry?: () => void;
  readonly testId?: string;
}

/**
 * Full-screen loading splash featuring a 60fps WebGL 3D curved-page fanning book
 * adapting to light (Warm Paper) and dark (Warm Graphite) themes with Antique Gold accents.
 */
export const LoadingSplash = memo(function LoadingSplash({
  title = 'Scholarium',
  subtitle = 'Active Study Reader',
  message = 'Preparing your active study library…',
  status = 'loading',
  error = null,
  theme,
  onRetry,
  testId = 'loading-splash',
}: LoadingSplashProps) {
  const themeContext = useContext(ThemeContext);
  const resolvedTheme = theme ?? themeContext?.theme ?? 'light';
  const isError = status === 'error';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountBookWebglScene(canvas, resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div
      data-testid={testId}
      className="scholarium-splash-backdrop flex size-full flex-col items-center justify-center px-6 select-none"
    >
      <div className="flex max-w-xs flex-col items-center gap-2.5 text-center">
        <div className="flex flex-col items-center">
          <div className="relative flex size-32 items-center justify-center">
            <canvas
              ref={canvasRef}
              data-testid="loading-splash-book-canvas"
              aria-label="Scholarium 3D Book Animation"
              className="size-full"
            />
          </div>
          <h1 className="-mt-3 line-clamp-2 font-serif text-xl font-semibold leading-snug tracking-tight">
            {title}
          </h1>
        </div>

        {subtitle.trim().length > 0 && (
          <p className="scholarium-gold-accent line-clamp-1 text-[11px] font-medium tracking-widest uppercase">
            {subtitle}
          </p>
        )}

        {isError ? (
          <div
            data-testid="loading-splash-error"
            className="flex flex-col items-center gap-2.5 rounded-xl border border-amber-600/30 bg-surface-subtle/80 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-black/30"
          >
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              {error ?? 'Initialization failed.'}
            </p>
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry Initialization
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-tx-muted">{message}</p>
        )}
      </div>
    </div>
  );
});
