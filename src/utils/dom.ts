import { useEffect, useLayoutEffect } from 'react';

/**
 * Pure DOM and browser environment utility helpers for SSR/Node safety.
 */

/**
 * Returns true if window is defined in the current runtime.
 */
export const hasWindow = (): boolean => typeof window !== 'undefined';

/**
 * Returns true if document is defined in the current runtime.
 */
export const hasDocument = (): boolean => typeof document !== 'undefined';

/**
 * Returns true if executed in a standard browser runtime with window and document available.
 */
export const isBrowser = (): boolean => hasWindow() && hasDocument();

/**
 * Isomorphic layout effect hook that safely resolves to useLayoutEffect in the browser
 * and useEffect in server-side/Node environments.
 */
export const useIsomorphicLayoutEffect = hasWindow() ? useLayoutEffect : useEffect;

/**
 * Returns true if the IntersectionObserver API is supported in the current environment.
 */
export const hasIntersectionObserver = (): boolean => typeof IntersectionObserver !== 'undefined';

/**
 * Safely queries a single DOM element matching the selector.
 * Returns null in non-browser runtimes or when the element is not found.
 */
export function selectElement<E extends Element = HTMLElement>(
  selector: string,
  parent?: ParentNode
): E | null {
  if (parent) {
    return parent.querySelector<E>(selector);
  }
  if (!hasDocument()) return null;
  return document.querySelector<E>(selector);
}

/**
 * Safely queries all DOM elements matching the selector.
 * Returns an empty array in non-browser runtimes or when no elements match.
 */
export function selectElements<E extends Element = HTMLElement>(
  selector: string,
  parent?: ParentNode
): E[] {
  if (parent) {
    return Array.from(parent.querySelectorAll<E>(selector));
  }
  if (!hasDocument()) return [];
  return Array.from(document.querySelectorAll<E>(selector));
}

/**
 * Safely triggers window.scrollTo if window and scrollTo are defined.
 */
export function safeScrollTo(options: ScrollToOptions): void {
  if (hasWindow() && typeof window.scrollTo === 'function') {
    window.scrollTo(options);
  }
}

/**
 * Safely invokes window.requestAnimationFrame if available.
 */
export function safeRequestAnimationFrame(callback: FrameRequestCallback): number | null {
  if (hasWindow() && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return null;
}

/**
 * Retrieves the viewport width or returns a fallback when running outside the browser.
 */
export function getViewportWidth(fallback = 1024): number {
  return hasWindow() ? window.innerWidth : fallback;
}

/**
 * Retrieves the viewport height or returns a fallback when running outside the browser.
 */
export function getViewportHeight(fallback = 768): number {
  return hasWindow() ? window.innerHeight : fallback;
}

/**
 * Retrieves the device pixel ratio or returns a fallback.
 */
export function getDevicePixelRatio(fallback = 1): number {
  return hasWindow() ? window.devicePixelRatio || fallback : fallback;
}

/**
 * Safely retrieves the current window selection.
 */
export function getWindowSelection(): Selection | null {
  return hasWindow() && typeof window.getSelection === 'function' ? window.getSelection() : null;
}
