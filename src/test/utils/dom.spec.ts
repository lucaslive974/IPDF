import {
  getDevicePixelRatio,
  getViewportHeight,
  getViewportWidth,
  getWindowSelection,
  hasDocument,
  hasIntersectionObserver,
  hasWindow,
  isBrowser,
  safeRequestAnimationFrame,
  safeScrollTo,
  selectElement,
  selectElements,
  useIsomorphicLayoutEffect,
} from '@utils/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DOM utility helpers', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  describe('hasWindow', () => {
    it('returns true when window is defined', () => {
      globalThis.window = {} as unknown as Window & typeof globalThis;
      expect(hasWindow()).toBe(true);
    });

    it('returns false when window is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(hasWindow()).toBe(false);
    });
  });

  describe('hasDocument', () => {
    it('returns true when document is defined', () => {
      globalThis.document = {} as unknown as Document;
      expect(hasDocument()).toBe(true);
    });

    it('returns false when document is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.document = undefined;
      expect(hasDocument()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('returns true when window and document are defined', () => {
      globalThis.window = {} as unknown as Window & typeof globalThis;
      globalThis.document = {} as unknown as Document;
      expect(isBrowser()).toBe(true);
    });

    it('returns false when window is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      globalThis.document = {} as unknown as Document;
      expect(isBrowser()).toBe(false);
    });

    it('returns false when document is undefined', () => {
      globalThis.window = {} as unknown as Window & typeof globalThis;
      // @ts-expect-error simulating non-browser
      globalThis.document = undefined;
      expect(isBrowser()).toBe(false);
    });
  });

  describe('hasIntersectionObserver', () => {
    it('returns true when IntersectionObserver is defined', () => {
      globalThis.IntersectionObserver = vi.fn() as unknown as typeof IntersectionObserver;
      expect(hasIntersectionObserver()).toBe(true);
    });

    it('returns false when IntersectionObserver is undefined', () => {
      // @ts-expect-error simulating missing API
      globalThis.IntersectionObserver = undefined;
      expect(hasIntersectionObserver()).toBe(false);
    });
  });

  describe('selectElement', () => {
    it('returns null when document is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.document = undefined;
      expect(selectElement('#test')).toBeNull();
    });

    it('queries document when no parent is specified', () => {
      const mockElement = { id: 'test' } as HTMLElement;
      globalThis.document = {
        querySelector: vi.fn((sel: string) => (sel === '#test' ? mockElement : null)),
      } as unknown as Document;

      expect(selectElement('#test')).toBe(mockElement);
      expect(selectElement('#not-found')).toBeNull();
    });

    it('queries custom parent when provided', () => {
      const mockElement = { id: 'child' } as HTMLElement;
      const customParent = {
        querySelector: vi.fn((sel: string) => (sel === '.child' ? mockElement : null)),
      } as unknown as ParentNode;

      expect(selectElement('.child', customParent)).toBe(mockElement);
      expect(customParent.querySelector).toHaveBeenCalledWith('.child');
    });
  });

  describe('selectElements', () => {
    it('returns empty array when document is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.document = undefined;
      expect(selectElements('.item')).toEqual([]);
    });

    it('queries all matching elements on document', () => {
      const el1 = { id: 'el-1' } as HTMLElement;
      const el2 = { id: 'el-2' } as HTMLElement;
      globalThis.document = {
        querySelectorAll: vi.fn((sel: string) => (sel === '.item' ? [el1, el2] : [])),
      } as unknown as Document;

      expect(selectElements('.item')).toEqual([el1, el2]);
      expect(selectElements('.empty')).toEqual([]);
    });

    it('queries all elements on custom parent node', () => {
      const el = { id: 'sub' } as HTMLElement;
      const customParent = {
        querySelectorAll: vi.fn((sel: string) => (sel === '.sub' ? [el] : [])),
      } as unknown as ParentNode;

      expect(selectElements('.sub', customParent)).toEqual([el]);
      expect(customParent.querySelectorAll).toHaveBeenCalledWith('.sub');
    });
  });

  describe('safeScrollTo', () => {
    it('calls window.scrollTo when window and scrollTo exist', () => {
      const scrollToSpy = vi.fn();
      globalThis.window = {
        scrollTo: scrollToSpy,
      } as unknown as Window & typeof globalThis;

      safeScrollTo({ top: 100, behavior: 'smooth' });
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' });
    });

    it('does not throw when window or scrollTo is missing', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(() => safeScrollTo({ top: 0 })).not.toThrow();
    });
  });

  describe('safeRequestAnimationFrame', () => {
    it('calls window.requestAnimationFrame when available', () => {
      const rafSpy = vi.fn().mockReturnValue(42);
      globalThis.window = {
        requestAnimationFrame: rafSpy,
      } as unknown as Window & typeof globalThis;

      const cb = vi.fn();
      const id = safeRequestAnimationFrame(cb);
      expect(id).toBe(42);
      expect(rafSpy).toHaveBeenCalledWith(cb);
    });

    it('returns null when window or requestAnimationFrame is missing', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(safeRequestAnimationFrame(vi.fn())).toBeNull();
    });
  });

  describe('getViewportWidth and getViewportHeight', () => {
    it('returns window dimensions when available', () => {
      globalThis.window = {
        innerWidth: 1920,
        innerHeight: 1080,
      } as unknown as Window & typeof globalThis;

      expect(getViewportWidth()).toBe(1920);
      expect(getViewportHeight()).toBe(1080);
    });

    it('returns fallback values when window is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(getViewportWidth(1440)).toBe(1440);
      expect(getViewportHeight(900)).toBe(900);
    });
  });

  describe('getDevicePixelRatio', () => {
    it('returns window.devicePixelRatio when available', () => {
      globalThis.window = {
        devicePixelRatio: 2,
      } as unknown as Window & typeof globalThis;
      expect(getDevicePixelRatio()).toBe(2);
    });

    it('returns fallback when devicePixelRatio is 0 or window is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(getDevicePixelRatio(1.5)).toBe(1.5);
    });
  });

  describe('getWindowSelection', () => {
    it('returns window.getSelection() when available', () => {
      const mockSelection = { isCollapsed: true } as Selection;
      globalThis.window = {
        getSelection: vi.fn().mockReturnValue(mockSelection),
      } as unknown as Window & typeof globalThis;

      expect(getWindowSelection()).toBe(mockSelection);
    });

    it('returns null when window is undefined', () => {
      // @ts-expect-error simulating non-browser
      globalThis.window = undefined;
      expect(getWindowSelection()).toBeNull();
    });
  });

  describe('useIsomorphicLayoutEffect', () => {
    it('is defined as a hook function', () => {
      expect(typeof useIsomorphicLayoutEffect).toBe('function');
    });
  });
});
