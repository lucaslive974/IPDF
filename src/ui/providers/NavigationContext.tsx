import type { BookMetadata } from '@domain/BookMetadata';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppViewMode = 'library' | 'reader' | 'settings';

export interface NavigationContextValue {
  readonly currentView: AppViewMode;
  readonly selectedBook: BookMetadata | null;
  setCurrentView(view: AppViewMode): void;
  openReader(book?: BookMetadata): void;
  closeReader(): void;
  openSettings(): void;
  closeSettings(): void;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
  readonly children?: ReactNode;
  readonly initialView?: AppViewMode;
}

export function NavigationProvider({ children, initialView = 'library' }: NavigationProviderProps) {
  const [currentView, setCurrentView] = useState<AppViewMode>(initialView);
  const [selectedBook, setSelectedBook] = useState<BookMetadata | null>(null);

  const openReader = useCallback((book?: BookMetadata) => {
    if (book) {
      setSelectedBook(book);
    }
    setCurrentView('reader');
  }, []);

  const closeReader = useCallback(() => {
    setCurrentView('library');
  }, []);

  const openSettings = useCallback(() => {
    setCurrentView('settings');
  }, []);

  const closeSettings = useCallback(() => {
    setCurrentView('library');
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      currentView,
      selectedBook,
      setCurrentView,
      openReader,
      closeReader,
      openSettings,
      closeSettings,
    }),
    [currentView, selectedBook, openReader, closeReader, openSettings, closeSettings]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
