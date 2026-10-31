import { type ThemeContextValue, useThemeContext } from '../providers/ThemeContext';

export function useTheme(): ThemeContextValue {
  return useThemeContext();
}
