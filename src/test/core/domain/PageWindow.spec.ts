import {
  INITIAL_ACTIVE_PAGES,
  INITIAL_BACKWARD_PAGES,
  INITIAL_FORWARD_PAGES,
  calculatePageWindow,
} from '@domain/PageWindow';
import { describe, expect, it } from 'vitest';

describe('PageWindow domain calculations', () => {
  it('calculates page window starting at page 1', () => {
    const window = calculatePageWindow(1, 100);
    expect(window.startPage).toBe(1);
    expect(window.count).toBe(INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES); // 10
  });

  it('calculates page window with backward margin for intermediate pages', () => {
    const window = calculatePageWindow(10, 100);
    expect(window.startPage).toBe(5); // 10 - 5
    expect(window.count).toBe(
      INITIAL_BACKWARD_PAGES + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES
    ); // 15
  });

  it('handles target page near the start when targetPage <= INITIAL_BACKWARD_PAGES', () => {
    const window = calculatePageWindow(3, 100);
    expect(window.startPage).toBe(1);
    // backward margin is 3 - 1 = 2; count is 2 + 5 + 5 = 12
    expect(window.count).toBe(12);
  });

  it('clamps count when window approaches totalPages', () => {
    const window = calculatePageWindow(98, 100);
    expect(window.startPage).toBe(93); // 98 - 5
    expect(window.count).toBe(8); // 100 - 93 + 1
  });

  it('clamps targetPage to totalPages when target exceeds totalPages', () => {
    const window = calculatePageWindow(150, 100);
    expect(window.startPage).toBe(95); // 100 - 5
    expect(window.count).toBe(6); // 100 - 95 + 1
  });

  it('clamps targetPage to 1 when target is zero or negative', () => {
    const window = calculatePageWindow(0, 100);
    expect(window.startPage).toBe(1);
    expect(window.count).toBe(10);
  });

  it('works when totalPages is undefined', () => {
    const window = calculatePageWindow(10);
    expect(window.startPage).toBe(5);
    expect(window.count).toBe(15);
  });
});
