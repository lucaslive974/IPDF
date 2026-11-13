import type { AppStartupStatus } from '@hooks/useAppStartup';
import { Button } from '@ui';
import { mountBookWebglScene } from '@utils/bookWebglRenderer';
import { useIsomorphicLayoutEffect } from '@utils/dom';
import { memo, useRef } from 'react';

export interface StartupSplashProps {
  readonly status: AppStartupStatus;
  readonly error: string | null;
  readonly onRetry: () => void;
}

/**
 * Startup loading screen featuring a 60fps WebGL 3D curved-page fanning book
 * in the 60-30-10 Warm Graphite / Warm Parchment / Antique Gold palette.
 */
export const StartupSplash = memo(function StartupSplash({
  status,
  error,
  onRetry,
}: StartupSplashProps) {
  const isError = status === 'error';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountBookWebglScene(canvas);
  }, []);

  return (
    <div
      data-testid="startup-splash"
      className="scholarium-splash-backdrop flex size-full flex-col items-center justify-center px-6 select-none"
    >
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative flex items-center justify-center">
          <div className="scholarium-logo-squircle relative flex size-40 items-center justify-center rounded-3xl p-5">
            <canvas
              ref={canvasRef}
              data-testid="startup-book-canvas"
              aria-label="Scholarium 3D Book Animation"
              className="relative z-10 size-full"
            />
          </div>
          <div className="scholarium-gold-ring pointer-events-none absolute inset-0 z-20 rounded-3xl" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Scholarium</h1>
          <p className="scholarium-gold-accent text-xs font-medium tracking-widest uppercase">
            Active Study Reader
          </p>
        </div>

        {isError ? (
          <div
            data-testid="startup-error"
            className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-black/30 px-4 py-3"
          >
            <p className="text-xs text-amber-200">{error ?? 'Startup initialization failed.'}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry Initialization
            </Button>
          </div>
        ) : (
          <p className="text-xs text-stone-400">Preparing your active study library…</p>
        )}
      </div>
    </div>
  );
});
