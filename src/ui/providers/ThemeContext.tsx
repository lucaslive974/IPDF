import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextValue {
  readonly theme: ThemeMode;
  readonly isDark: boolean;
  setTheme(mode: ThemeMode): void;
  toggleTheme(): void;
}

const STORAGE_KEY = 'scholarium_theme';
const DEFAULT_THEME: ThemeMode = 'light';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function resolveThemeMode(storedValue?: string | null): ThemeMode {
  if (storedValue === 'light' || storedValue === 'dark') {
    return storedValue;
  }
  return DEFAULT_THEME;
}

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }
  return resolveThemeMode(window.localStorage.getItem(STORAGE_KEY));
}

export interface ThemeProviderProps {
  readonly children?: ReactNode;
  readonly initialTheme?: ThemeMode;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme ?? resolveInitialTheme);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
