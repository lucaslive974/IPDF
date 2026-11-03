import { LruCache } from '@core/utils/lruCache';
import type { BookMetadata } from '@domain/BookMetadata';
import type {
  DocumentPage,
  IReaderService,
  LLMRequest,
  ReadingContext,
} from '@ports/IReaderService';

export interface CacheWindowBounds {
  readonly start: number | null;
  readonly end: number | null;
}

/**
 * Universal LRU Cache decorator for IReaderService.
 * Implements a 50-page centered sliding window with:
 * - 20 pages before, 10 active, 20 pages after on initial bootstrap / jumps
 * - Fully asynchronous, non-blocking edge prefetch (+25 pages) triggered within 10 pages of a boundary
 * - Direction-based prefetch locking to avoid IPC channel flooding
 * - Immediate abort of in-flight prefetch via AbortController on book changes or navigation jumps
 * - Transparent pass-through of non-page IReaderService capabilities
 */
export class CachedReaderServiceDecorator implements IReaderService {
  private readonly inner: IReaderService;
  private readonly cache: LruCache<string, DocumentPage>;
  private readonly defaultCapacity: number;

  private currentBookHash: string | null = null;
  private windowStart: number | null = null;
  private windowEnd: number | null = null;

  private inFlightPrefetchDirection: 'forward' | 'backward' | null = null;
  private prefetchAbortController: AbortController | null = null;

  public constructor(inner: IReaderService, capacity = 50) {
    this.inner = inner;
    this.defaultCapacity = Math.max(10, capacity);
    this.cache = new LruCache<string, DocumentPage>(this.defaultCapacity);
  }

  public async getBookPages(
    bookHash: string,
    startPage: number,
    count: number
  ): Promise<DocumentPage[]> {
    // 1. Book switch detected
    if (this.currentBookHash !== null && this.currentBookHash !== bookHash) {
      this.abortCurrentPrefetch();
      this.cache.clear();
      this.windowStart = null;
      this.windowEnd = null;
    }
    this.currentBookHash = bookHash;

    const requestedEnd = startPage + count - 1;

    // 2. Determine if bootstrap or jump is required
    const isUninitialized = this.windowStart === null || this.windowEnd === null;
    const isJump =
      !isUninitialized &&
      (startPage < (this.windowStart as number) - 10 ||
        requestedEnd > (this.windowEnd as number) + 10);

    if (isUninitialized || isJump) {
      this.abortCurrentPrefetch();
      await this.bootstrapCenteredWindow(bookHash, startPage, count);
    }

    // 3. Ensure any missing pages within the requested block are loaded
    const missingPages = this.findMissingPageNumbers(bookHash, startPage, count);
    if (missingPages.length > 0) {
      const fetched = await this.inner.getBookPages(bookHash, startPage, count);
      if (fetched.length > 0) {
        this.cache.putMany(
          fetched.map((p) => ({
            key: this.buildKey(bookHash, p.pageNumber),
            value: p,
          }))
        );
        this.recalculateWindowBounds(bookHash);
      }
    }

    // 4. Check edge proximity and trigger asynchronous non-blocking prefetch
    this.checkAndTriggerEdgePrefetch(bookHash, startPage, count);

    // 5. Collect and return requested pages from cache immediately
    return this.collectCachedPages(bookHash, startPage, count);
  }

  private async bootstrapCenteredWindow(
    bookHash: string,
    anchorPage: number,
    _requestedCount: number
  ): Promise<void> {
    const targetBefore = 20;
    const windowStart = Math.max(1, anchorPage - targetBefore);
    const windowCount = this.defaultCapacity;

    const pages = await this.inner.getBookPages(bookHash, windowStart, windowCount);
    if (pages.length > 0) {
      this.cache.putMany(
        pages.map((p) => ({
          key: this.buildKey(bookHash, p.pageNumber),
          value: p,
        }))
      );
      this.recalculateWindowBounds(bookHash);
    }
  }

  private checkAndTriggerEdgePrefetch(bookHash: string, startPage: number, count: number): void {
    if (this.windowStart === null || this.windowEnd === null) return;

    const requestedEnd = startPage + count - 1;

    // Approaching right edge (Page Down / forward reading)
    if (this.windowEnd - requestedEnd <= 10 && this.inFlightPrefetchDirection !== 'forward') {
      void this.triggerBackgroundExpansion(bookHash, 'forward', this.windowEnd + 1, 25);
    }
    // Approaching left edge (Page Up / backward reading)
    else if (
      startPage - this.windowStart <= 10 &&
      this.windowStart > 1 &&
      this.inFlightPrefetchDirection !== 'backward'
    ) {
      const prevStart = Math.max(1, this.windowStart - 25);
      const prevCount = this.windowStart - prevStart;
      if (prevCount > 0) {
        void this.triggerBackgroundExpansion(bookHash, 'backward', prevStart, prevCount);
      }
    }
  }

  private async triggerBackgroundExpansion(
    bookHash: string,
    direction: 'forward' | 'backward',
    start: number,
    count: number
  ): Promise<void> {
    this.abortCurrentPrefetch();
    this.prefetchAbortController = new AbortController();
    const signal = this.prefetchAbortController.signal;
    this.inFlightPrefetchDirection = direction;

    try {
      const pages = await this.inner.getBookPages(bookHash, start, count);
      if (signal.aborted) {
        return;
      }

      if (pages.length > 0) {
        // Discard pages from the opposite edge to maintain exact window capacity and symmetry
        const currentNumbers = this.getCachedPageNumbers(bookHash);
        const excess = currentNumbers.length + pages.length - this.defaultCapacity;
        if (excess > 0) {
          const toRemove =
            direction === 'forward'
              ? currentNumbers.slice(0, excess) // drop trailing pages on the left
              : currentNumbers.slice(-excess); // drop trailing pages on the right
          for (const num of toRemove) {
            this.cache.delete(this.buildKey(bookHash, num));
          }
        }

        this.cache.putMany(
          pages.map((p) => ({
            key: this.buildKey(bookHash, p.pageNumber),
            value: p,
          }))
        );
        this.recalculateWindowBounds(bookHash);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.warn('Background edge prefetch failed gracefully:', err);
      }
    } finally {
      if (this.inFlightPrefetchDirection === direction) {
        this.inFlightPrefetchDirection = null;
      }
    }
  }

  private abortCurrentPrefetch(): void {
    if (this.prefetchAbortController) {
      this.prefetchAbortController.abort();
      this.prefetchAbortController = null;
    }
    this.inFlightPrefetchDirection = null;
  }

  private findMissingPageNumbers(bookHash: string, startPage: number, count: number): number[] {
    const missing: number[] = [];
    for (let p = startPage; p < startPage + count; p++) {
      if (!this.cache.has(this.buildKey(bookHash, p))) {
        missing.push(p);
      }
    }
    return missing;
  }

  private collectCachedPages(bookHash: string, startPage: number, count: number): DocumentPage[] {
    const pages: DocumentPage[] = [];
    for (let p = startPage; p < startPage + count; p++) {
      const page = this.cache.get(this.buildKey(bookHash, p));
      if (page) {
        pages.push(page);
      }
    }
    return pages;
  }

  private getCachedPageNumbers(bookHash: string): number[] {
    const prefix = `${bookHash}:`;
    const pageNumbers: number[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const num = Number.parseInt(key.slice(prefix.length), 10);
        if (!Number.isNaN(num)) {
          pageNumbers.push(num);
        }
      }
    }
    return pageNumbers.sort((a, b) => a - b);
  }

  private recalculateWindowBounds(bookHash: string): void {
    const pageNumbers = this.getCachedPageNumbers(bookHash);
    if (pageNumbers.length > 0) {
      this.windowStart = pageNumbers[0] ?? null;
      this.windowEnd = pageNumbers[pageNumbers.length - 1] ?? null;
    } else {
      this.windowStart = null;
      this.windowEnd = null;
    }
  }

  private buildKey(bookHash: string, pageNumber: number): string {
    return `${bookHash}:${pageNumber}`;
  }

  // Diagnostics & Observability
  public getWindowBounds(): CacheWindowBounds {
    return { start: this.windowStart, end: this.windowEnd };
  }

  public get inFlightDirection(): 'forward' | 'backward' | null {
    return this.inFlightPrefetchDirection;
  }

  public get cacheSize(): number {
    return this.cache.size;
  }

  public getCachedPage(bookHash: string, pageNumber: number): DocumentPage | undefined {
    return this.cache.peek(this.buildKey(bookHash, pageNumber));
  }

  public clearCache(): void {
    this.abortCurrentPrefetch();
    this.cache.clear();
    this.windowStart = null;
    this.windowEnd = null;
  }

  // Transparent delegation of IReaderService pass-through operations
  public readBookBinary(bookHash: string): Promise<Uint8Array> {
    return this.inner.readBookBinary(bookHash);
  }

  public updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number
  ): Promise<BookMetadata> {
    return this.inner.updateBookProgress(bookHash, currentPage, totalPages);
  }

  public async getBookFilePath(bookHash: string): Promise<string | null> {
    if (this.inner.getBookFilePath) {
      return this.inner.getBookFilePath(bookHash);
    }
    return null;
  }

  public buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage?: string
  ): Promise<LLMRequest> {
    return this.inner.buildTermLookupRequest(context, targetLanguage);
  }
}
