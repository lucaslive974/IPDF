import type { BookMetadata } from '@domain/BookMetadata';
import type { ILibraryService } from '@ports/ILibraryService';
import type { ISettingsService, PlatformInfo } from '@ports/ISettingsService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_STARTUP_MIN_DISPLAY_MS = 5000;

export type AppStartupStatus = 'loading' | 'ready' | 'error';

export interface AppStartupDependencies {
  readonly settingsService: Pick<ISettingsService, 'healthcheck' | 'getPlatformInfo'>;
  readonly libraryService: Pick<ILibraryService, 'listLibraryBooks'>;
  readonly setBooks: (books: readonly BookMetadata[]) => void;
}

export interface AppStartupResult {
  readonly healthMessage: string;
  readonly platformInfo: PlatformInfo;
  readonly books: readonly BookMetadata[];
}

export interface UseAppStartupOptions {
  readonly minDisplayMs?: number;
}

export interface UseAppStartupReturn {
  readonly status: AppStartupStatus;
  readonly isOverlayVisible: boolean;
  readonly error: string | null;
  readonly platformInfo: PlatformInfo | null;
  readonly minDisplayMs: number;
  readonly retry: () => void;
}

/**
 * Formats unknown startup errors into user-facing messages.
 */
export function formatStartupError(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return err;
  }
  return 'Unable to initialize Scholarium backend services.';
}

/**
 * Runs backend health, platform/database verification, and library hydration in parallel.
 */
export async function executeAppStartup(deps: AppStartupDependencies): Promise<AppStartupResult> {
  const [healthMessage, platformInfo, books] = await Promise.all([
    deps.settingsService.healthcheck(),
    deps.settingsService.getPlatformInfo(),
    deps.libraryService.listLibraryBooks(),
  ]);

  if (!healthMessage || healthMessage.trim().length === 0) {
    throw new Error('Backend health check returned an empty response');
  }

  if (!platformInfo.databasePath || platformInfo.databasePath.trim().length === 0) {
    throw new Error('Database path is unavailable');
  }

  deps.setBooks(books);

  return {
    healthMessage,
    platformInfo,
    books,
  };
}

/**
 * ViewModel hook orchestrating startup health checks, database hydration, and retry state.
 */
export function useAppStartup(options: UseAppStartupOptions = {}): UseAppStartupReturn {
  const { minDisplayMs = DEFAULT_STARTUP_MIN_DISPLAY_MS } = options;
  const { settingsService, libraryService } = useServiceContainer();
  const setBooks = useLibraryStore((s) => s.setBooks);

  const [status, setStatus] = useState<AppStartupStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    void attempt;

    executeAppStartup({
      settingsService,
      libraryService,
      setBooks,
    })
      .then((result) => {
        if (isCancelled) return;
        setPlatformInfo(result.platformInfo);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        setError(formatStartupError(err));
        setStatus('error');
      });

    return () => {
      isCancelled = true;
    };
  }, [attempt, libraryService, setBooks, settingsService]);

  return {
    status,
    isOverlayVisible: status !== 'ready',
    error,
    platformInfo,
    minDisplayMs,
    retry,
  };
}
