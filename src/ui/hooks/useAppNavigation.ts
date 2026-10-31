import { useCallback, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { AppViewMode } from './studyWorkbenchTypes';

export interface AppNavigationHook {
  readonly currentView: AppViewMode;
  setCurrentView(view: AppViewMode): void;
  openReader(book?: BookMetadata): void;
  closeReader(): void;
  openSettings(): void;
  closeSettings(): void;
}

export function useAppNavigation(
  initialView: AppViewMode = 'library',
  onCloseReader?: () => void
): AppNavigationHook {
  const [currentView, setCurrentView] = useState<AppViewMode>(initialView);

  const openReader = useCallback((_book?: BookMetadata) => {
    setCurrentView('reader');
  }, []);

  const closeReader = useCallback(() => {
    setCurrentView('library');
    onCloseReader?.();
  }, [onCloseReader]);

  const openSettings = useCallback(() => {
    setCurrentView('settings');
  }, []);

  const closeSettings = useCallback(() => {
    setCurrentView('library');
  }, []);

  return {
    currentView,
    setCurrentView,
    openReader,
    closeReader,
    openSettings,
    closeSettings,
  };
}
