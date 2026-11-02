import { ThemeProvider, resolveThemeMode, useTheme } from '@providers/ThemeContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

describe('useTheme hook', () => {
  function ConsumerComponent() {
    const { theme, isDark } = useTheme();
    return React.createElement(
      'div',
      { 'data-testid': 'theme-consumer' },
      `${theme}-${isDark ? 'dark' : 'light'}`
    );
  }

  it('throws when used outside of ThemeProvider', () => {
    expect(() => renderToStaticMarkup(React.createElement(ConsumerComponent))).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
  });

  it('provides theme context inside ThemeProvider', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        { initialTheme: 'dark' },
        React.createElement(ConsumerComponent)
      )
    );
    expect(markup).toContain('dark-dark');
  });
});
