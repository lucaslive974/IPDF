import type { AppStartupStatus } from '@hooks/useAppStartup';
import type { ThemeMode } from '@providers/ThemeContext';
import { Button } from '@ui';
import { mountBookWebglScene } from '@utils/bookWebglRenderer';
import { useIsomorphicLayoutEffect } from '@utils/dom';
import { memo, useRef } from 'react';

export interface StartupSplashProps {
  readonly status: AppStartupStatus;
  readonly error: string | null;
  readonly theme?: ThemeMode;
  readonly onRetry: () => void;
}

/**
 * Startup loading screen featuring a 60fps WebGL 3D curved-page fanning book
 * adapting to light (Warm Paper) and dark (Warm Graphite) themes with Antique Gold accents.
 */
export const StartupSplash = memo(function StartupSplash({
  status,
  error,
  theme = 'light',
  onRetry,
}: StartupSplashProps) {
  const isError = status === 'error';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountBookWebglScene(canvas, theme);
  }, [theme]);

  return (
    <div
      data-testid="startup-splash"
      className="scholarium-splash-backdrop flex size-full flex-col items-center justify-center px-6 select-none"
    >
      <div className="flex max-w-xs flex-col items-center gap-2.5 text-center">
        <div className="flex flex-col items-center">
          <div className="relative flex size-32 items-center justify-center">
            <canvas
              ref={canvasRef}
              data-testid="startup-book-canvas"
              aria-label="Scholarium 3D Book Animation"
              className="size-full"
            />
          </div>
          <h1 className="-mt-3 font-serif text-xl font-semibold leading-none tracking-tight">
            Scholarium
          </h1>
        </div>

        <p className="scholarium-gold-accent text-[11px] font-medium tracking-widest uppercase">
          Active Study Reader
        </p>

        {isError ? (
          <div
            data-testid="startup-error"
            className="flex flex-col items-center gap-2.5 rounded-xl border border-amber-600/30 bg-surface-subtle/80 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-black/30"
          >
            <p className="text-[11px] text-amber-800 dark:text-amber-200">
              {error ?? 'Startup initialization failed.'}
            </p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry Initialization
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-tx-muted">Preparing your active study library…</p>
        )}
      </div>
    </div>
  );
});
