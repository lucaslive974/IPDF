import { resolveThemeMode } from '@providers/ThemeContext';
import { describe, expect, it } from 'vitest';

describe('resolveThemeMode', () => {
  it('returns light when no value is stored', () => {
    expect(resolveThemeMode(null)).toBe('light');
    expect(resolveThemeMode(undefined)).toBe('light');
    expect(resolveThemeMode('')).toBe('light');
  });

  it('returns valid stored theme mode', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('light')).toBe('light');
  });

  it('defaults to light on unknown string', () => {
    expect(resolveThemeMode('solarized')).toBe('light');
  });
});
