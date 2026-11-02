import { LruCache } from '@core/utils/lruCache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('LruCache (Core Utility for Services)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('initializes with capacity number and default configuration', () => {
    const cache = new LruCache<string, number>(3);
    expect(cache.maxCapacity).toBe(3);
    expect(cache.size).toBe(0);
    expect(cache.stats).toEqual({
      hits: 0,
      misses: 0,
      hitRatio: 0,
      size: 0,
      maxCapacity: 3,
    });
  });

  it('initializes with options object and clamps minimum capacity to 1', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, string>({
      maxCapacity: 0,
      onEvict,
      ttlMs: 5000,
    });
    expect(cache.maxCapacity).toBe(1);
    cache.put('a', 'alpha');
    cache.put('b', 'beta');
    expect(cache.size).toBe(1);
    expect(onEvict).toHaveBeenCalledWith('a', 'alpha');
  });

  it('maintains LRU order and evicts oldest items when capacity is exceeded', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, string>({ maxCapacity: 3, onEvict });

    cache.put('p1', 'page 1');
    cache.put('p2', 'page 2');
    cache.put('p3', 'page 3');

    // Access p1 so it becomes MRU (order: p2, p3, p1)
    expect(cache.get('p1')).toBe('page 1');

    // Insert p4 -> p2 should be evicted
    cache.put('p4', 'page 4');

    expect(cache.size).toBe(3);
    expect(cache.has('p2')).toBe(false);
    expect(cache.has('p1')).toBe(true);
    expect(cache.has('p3')).toBe(true);
    expect(cache.has('p4')).toBe(true);
    expect(onEvict).toHaveBeenCalledWith('p2', 'page 2');
  });

  it('updates existing key without exceeding capacity and moves it to MRU', () => {
    const cache = new LruCache<number, string>(2);
    cache.put(1, 'old');
    cache.put(2, 'val2');

    cache.put(1, 'updated');
    expect(cache.size).toBe(2);
    expect(cache.get(1)).toBe('updated');

    // Insert 3 -> 2 should be evicted because 1 was just updated
    cache.put(3, 'val3');
    expect(cache.has(2)).toBe(false);
    expect(cache.has(1)).toBe(true);
    expect(cache.has(3)).toBe(true);
  });

  it('supports peek without altering MRU recency order or metrics', () => {
    const cache = new LruCache<string, string>(2);
    cache.put('a', 'A');
    cache.put('b', 'B');

    // peek 'a' should not move 'a' to MRU
    expect(cache.peek('a')).toBe('A');
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);

    // Insert 'c' -> 'a' should be evicted because peek did not touch it
    cache.put('c', 'C');
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('tracks hit, miss, and hitRatio stats accurately', () => {
    const cache = new LruCache<string, number>(5);
    cache.put('a', 10);

    expect(cache.get('a')).toBe(10); // hit
    expect(cache.get('b')).toBeUndefined(); // miss
    expect(cache.get('a')).toBe(10); // hit

    expect(cache.stats).toEqual({
      hits: 2,
      misses: 1,
      hitRatio: 2 / 3,
      size: 1,
      maxCapacity: 5,
    });

    cache.resetStats();
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);
    expect(cache.stats.hitRatio).toBe(0);
  });

  it('respects protected keys during eviction', () => {
    const cache = new LruCache<number, string>(3);
    cache.put(1, 'page 1');
    cache.put(2, 'page 2');
    cache.put(3, 'page 3');

    // Protect page 1 even though it is oldest
    const protectedKeys = new Set([1]);
    cache.put(4, 'page 4', { protectedKeys });

    // Page 2 should be evicted instead of Page 1
    expect(cache.has(1)).toBe(true);
    expect(cache.has(2)).toBe(false);
    expect(cache.has(3)).toBe(true);
    expect(cache.has(4)).toBe(true);
  });

  it('supports batch putMany and getMany operations', () => {
    const cache = new LruCache<string, number>(4);

    cache.putMany([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
      { key: 'd', value: 4 },
    ]);

    expect(cache.size).toBe(4);
    const chunk = cache.getMany(['b', 'd', 'missing']);
    expect(chunk.size).toBe(2);
    expect(chunk.get('b')).toBe(2);
    expect(chunk.get('d')).toBe(4);
    expect(chunk.has('missing')).toBe(false);
  });

  it('deletes specific keys and triggers onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, string>({ maxCapacity: 5, onEvict });

    cache.put('k1', 'v1');
    expect(cache.delete('k1')).toBe(true);
    expect(cache.delete('non-existent')).toBe(false);
    expect(cache.has('k1')).toBe(false);
    expect(onEvict).toHaveBeenCalledWith('k1', 'v1');
  });

  it('clears matching items using clearWhere (slice clearing)', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, string>({ maxCapacity: 10, onEvict });

    cache.put('bookA:1', 'p1');
    cache.put('bookA:2', 'p2');
    cache.put('bookB:1', 'p1');

    const removed = cache.clearWhere((key) => key.startsWith('bookA:'));
    expect(removed).toBe(2);
    expect(cache.size).toBe(1);
    expect(cache.has('bookB:1')).toBe(true);
    expect(onEvict).toHaveBeenCalledWith('bookA:1', 'p1');
    expect(onEvict).toHaveBeenCalledWith('bookA:2', 'p2');
  });

  it('clears all items and triggers onEvict on clear()', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>({ maxCapacity: 5, onEvict });
    cache.put('x', 1);
    cache.put('y', 2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(onEvict).toHaveBeenCalledWith('x', 1);
    expect(onEvict).toHaveBeenCalledWith('y', 2);
  });

  it('handles TTL expiration seamlessly on get, has, and peek', () => {
    vi.useFakeTimers();
    try {
      const cache = new LruCache<string, string>({ maxCapacity: 5, ttlMs: 1000 });
      cache.put('temp', 'temporary');

      expect(cache.has('temp')).toBe(true);
      expect(cache.peek('temp')).toBe('temporary');
      expect(cache.get('temp')).toBe('temporary');

      // Advance clock past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.peek('temp')).toBeUndefined();
      expect(cache.has('temp')).toBe(false);
      expect(cache.get('temp')).toBeUndefined();
      expect(cache.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes keys, values, and entries in recency order', () => {
    const cache = new LruCache<string, number>(3);
    cache.put('a', 1);
    cache.put('b', 2);
    cache.put('c', 3);

    // Access 'a' to make it MRU
    cache.get('a');

    expect(cache.keys()).toEqual(['b', 'c', 'a']);
    expect(cache.values()).toEqual([2, 3, 1]);
    expect(cache.entries()).toEqual([
      ['b', 2],
      ['c', 3],
      ['a', 1],
    ]);
  });
});
