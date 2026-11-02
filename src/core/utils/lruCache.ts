export interface LruCacheOptions<K, V> {
  /** Maximum number of entries allowed before triggering eviction */
  readonly maxCapacity: number;
  /** Optional callback invoked when an entry is evicted or deleted */
  readonly onEvict?: (key: K, value: V) => void;
  /** Optional default time-to-live in milliseconds */
  readonly ttlMs?: number;
}

export interface LruCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly hitRatio: number;
  readonly size: number;
  readonly maxCapacity: number;
}

interface InternalEntry<V> {
  readonly value: V;
  readonly expiresAt?: number;
}

/**
 * Universal Least-Recently-Used (LRU) Cache engineered for high-throughput services.
 * Features O(1) reads/writes via native Map iteration semantics, optional TTL expiration,
 * key protection during bulk prefetching, atomic batch operations, and telemetry metrics.
 */
export class LruCache<K = string, V = unknown> {
  private readonly items = new Map<K, InternalEntry<V>>();
  public readonly maxCapacity: number;
  private readonly defaultTtlMs?: number;
  private onEvict?: (key: K, value: V) => void;

  private hitsCount = 0;
  private missesCount = 0;

  constructor(options: number | LruCacheOptions<K, V>) {
    if (typeof options === 'number') {
      this.maxCapacity = Math.max(1, options);
    } else {
      this.maxCapacity = Math.max(1, options.maxCapacity);
      this.onEvict = options.onEvict;
      this.defaultTtlMs = options.ttlMs && options.ttlMs > 0 ? options.ttlMs : undefined;
    }
  }

  public setOnEvict(onEvict: (key: K, value: V) => void): void {
    this.onEvict = onEvict;
  }

  public get size(): number {
    return this.items.size;
  }

  public get stats(): LruCacheStats {
    const total = this.hitsCount + this.missesCount;
    return {
      hits: this.hitsCount,
      misses: this.missesCount,
      hitRatio: total > 0 ? this.hitsCount / total : 0,
      size: this.items.size,
      maxCapacity: this.maxCapacity,
    };
  }

  public resetStats(): void {
    this.hitsCount = 0;
    this.missesCount = 0;
  }

  public has(key: K): boolean {
    const entry = this.items.get(key);
    if (!entry) {
      return false;
    }
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Retrieves an item by key, marking it as most recently used.
   * Increments hit/miss counters and removes expired entries.
   */
  public get(key: K): V | undefined {
    const entry = this.items.get(key);
    if (!entry) {
      this.missesCount++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.missesCount++;
      return undefined;
    }

    // Re-insert to move to the end of Map iteration (MRU)
    this.items.delete(key);
    this.items.set(key, entry);
    this.hitsCount++;

    return entry.value;
  }

  /**
   * Inspects an item by key WITHOUT altering its recency order or updating metrics.
   */
  public peek(key: K): V | undefined {
    const entry = this.items.get(key);
    if (!entry || this.isExpired(entry)) {
      return undefined;
    }
    return entry.value;
  }

  /**
   * Inserts or updates an entry, placing it at the MRU position.
   * If capacity is exceeded, oldest non-protected entries are evicted.
   */
  public put(key: K, value: V, options?: { protectedKeys?: ReadonlySet<K>; ttlMs?: number }): void {
    if (this.items.has(key)) {
      this.items.delete(key);
    }

    const ttl = options?.ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl !== undefined ? Date.now() + ttl : undefined;

    this.items.set(key, { value, expiresAt });

    if (this.items.size > this.maxCapacity) {
      this.evictOldest(this.items.size - this.maxCapacity, options?.protectedKeys);
    }
  }

  /**
   * Inserts multiple entries in batch.
   */
  public putMany(
    entries: ReadonlyArray<{ readonly key: K; readonly value: V; readonly ttlMs?: number }>,
    protectedKeys?: ReadonlySet<K>
  ): void {
    const now = Date.now();
    for (const entry of entries) {
      if (this.items.has(entry.key)) {
        this.items.delete(entry.key);
      }
      const ttl = entry.ttlMs ?? this.defaultTtlMs;
      const expiresAt = ttl !== undefined ? now + ttl : undefined;
      this.items.set(entry.key, { value: entry.value, expiresAt });
    }

    if (this.items.size > this.maxCapacity) {
      this.evictOldest(this.items.size - this.maxCapacity, protectedKeys);
    }
  }

  /**
   * Retrieves multiple items in batch. Missing or expired items are omitted from the result.
   */
  public getMany(keys: ReadonlyArray<K>): Map<K, V> {
    const result = new Map<K, V>();
    for (const key of keys) {
      const val = this.get(key);
      if (val !== undefined) {
        result.set(key, val);
      }
    }
    return result;
  }

  /**
   * Evicts the oldest entries according to LRU order, skipping protected keys.
   */
  public evictOldest(count: number, protectedKeys?: ReadonlySet<K>): number {
    if (count <= 0 || this.items.size === 0) return 0;

    let evicted = 0;
    for (const [key, entry] of this.items.entries()) {
      if (protectedKeys?.has(key)) {
        continue;
      }
      this.items.delete(key);
      this.onEvict?.(key, entry.value);
      evicted++;
      if (evicted >= count) {
        break;
      }
    }
    return evicted;
  }

  /**
   * Deletes an item explicitly by key.
   */
  public delete(key: K): boolean {
    const entry = this.items.get(key);
    if (!entry) {
      return false;
    }
    this.items.delete(key);
    this.onEvict?.(key, entry.value);
    return true;
  }

  /**
   * Removes all entries that satisfy the given predicate.
   * Highly useful for clearing cache slices (e.g. by bookHash or tenant).
   */
  public clearWhere(predicate: (key: K, value: V) => boolean): number {
    let removed = 0;
    for (const [key, entry] of this.items.entries()) {
      if (predicate(key, entry.value)) {
        this.items.delete(key);
        this.onEvict?.(key, entry.value);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Purges all entries from the cache.
   */
  public clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.items.entries()) {
        this.onEvict(key, entry.value);
      }
    }
    this.items.clear();
  }

  public keys(): readonly K[] {
    return Array.from(this.items.keys());
  }

  public values(): readonly V[] {
    return Array.from(this.items.values()).map((e) => e.value);
  }

  public entries(): ReadonlyArray<readonly [K, V]> {
    return Array.from(this.items.entries()).map(([k, e]) => [k, e.value] as const);
  }

  private isExpired(entry: InternalEntry<V>): boolean {
    if (entry.expiresAt === undefined) {
      return false;
    }
    return Date.now() > entry.expiresAt;
  }
}
