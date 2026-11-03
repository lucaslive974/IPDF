import { CachedReaderServiceDecorator } from '@adapters/ipc/CachedReaderServiceDecorator';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import type {
  DocumentPage,
  IReaderService,
  LLMRequest,
  ReadingContext,
} from '@ports/IReaderService';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockReaderService implements IReaderService {
  public pages: DocumentPage[] = [];
  public getBookPagesMock = vi.fn(
    async (_bookHash: string, startPage: number, count: number): Promise<DocumentPage[]> => {
      const result: DocumentPage[] = [];
      for (let i = startPage; i < startPage + count; i++) {
        const found = this.pages.find((p) => p.pageNumber === i);
        if (found) {
          result.push(found);
        } else {
          result.push({
            pageNumber: i,
            chapterTitle: `Chapter ${Math.ceil(i / 10)}`,
            paragraphs: [`Paragraph text on page ${i}`],
            cfiBase: `/6/${i}!`,
          });
        }
      }
      return result;
    }
  );

  public async getBookPages(
    bookHash: string,
    startPage: number,
    count: number
  ): Promise<DocumentPage[]> {
    return this.getBookPagesMock(bookHash, startPage, count);
  }

  public readBookBinaryMock = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  public async readBookBinary(bookHash: string): Promise<Uint8Array> {
    return this.readBookBinaryMock(bookHash);
  }

  public updateBookProgressMock = vi.fn().mockResolvedValue({
    bookHash: 'book-1',
    title: 'Test Book',
    author: 'Author',
    currentPage: 10,
    totalPages: 100,
    percentage: 10,
    format: BookFormat.EPUB,
    tags: [],
    lastReadAt: new Date(),
    updatedAt: new Date(),
  } as BookMetadata);

  public async updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number,
    pageOffsetRatio = 0.0
  ): Promise<BookMetadata> {
    return this.updateBookProgressMock(bookHash, currentPage, totalPages, pageOffsetRatio);
  }

  public getBookFilePathMock = vi.fn().mockResolvedValue('/path/to/book.epub');
  public async getBookFilePath(bookHash: string): Promise<string | null> {
    return this.getBookFilePathMock(bookHash);
  }

  public buildTermLookupRequestMock = vi.fn().mockResolvedValue({
    systemPrompt: 'System',
    userPrompt: 'User',
    temperature: 0.2,
    maxTokens: 500,
  } as LLMRequest);

  public async buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage?: string
  ): Promise<LLMRequest> {
    return this.buildTermLookupRequestMock(context, targetLanguage);
  }
}

describe('CachedReaderServiceDecorator (Intelligent Sliding Window & Async Edge Prefetch)', () => {
  let mockInner: MockReaderService;
  let decorator: CachedReaderServiceDecorator;

  beforeEach(() => {
    mockInner = new MockReaderService();
    decorator = new CachedReaderServiceDecorator(mockInner, 50);
  });

  it('bootstraps a centered window on first request and serves subsequent requests from cache with 0ms I/O', async () => {
    // Request page 25 (count 1)
    const pages = await decorator.getBookPages('book-1', 25, 1);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNumber).toBe(25);

    // Initial bootstrap should load 50 pages centered: 20 before (from page 5) + 10 active + 20 after
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockInner.getBookPagesMock.mock.calls[0];
    expect(firstCallArgs?.[0]).toBe('book-1');
    expect(firstCallArgs?.[1]).toBe(5); // 25 - 20 = 5
    expect(firstCallArgs?.[2]).toBe(50); // 50 pages total

    const bounds = decorator.getWindowBounds();
    expect(bounds.start).toBe(5);
    expect(bounds.end).toBe(54);

    // Request page 26 from the comfortable center zone
    const nextPages = await decorator.getBookPages('book-1', 26, 1);
    expect(nextPages).toHaveLength(1);
    expect(nextPages[0]?.pageNumber).toBe(26);

    // Zero additional backend calls!
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(1);
  });

  it('triggers asynchronous background forward prefetch (+25 pages) when within 10 pages of the right edge', async () => {
    // Bootstrap at page 20: window will be [1 .. 50]
    await decorator.getBookPages('book-1', 20, 1);
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(1);

    const initialBounds = decorator.getWindowBounds();
    expect(initialBounds.start).toBe(1);
    expect(initialBounds.end).toBe(50);

    // Request page 42 (distance to right edge: 50 - 42 = 8 <= 10)
    const pages = await decorator.getBookPages('book-1', 42, 1);
    expect(pages[0]?.pageNumber).toBe(42);

    // Allow background async promise to tick
    await new Promise((resolve) => setTimeout(resolve, 10));

    // A forward expansion should have been fired for 25 pages [51 .. 75]
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(2);
    const prefetchCall = mockInner.getBookPagesMock.mock.calls[1];
    expect(prefetchCall?.[1]).toBe(51); // 50 + 1
    expect(prefetchCall?.[2]).toBe(25); // +25 pages

    // Cache should hold max 50 pages: pages [26 .. 75] (oldest 25 pages evicted)
    expect(decorator.cacheSize).toBe(50);
    const updatedBounds = decorator.getWindowBounds();
    expect(updatedBounds.start).toBe(26);
    expect(updatedBounds.end).toBe(75);
    expect(decorator.getCachedPage('book-1', 1)).toBeUndefined(); // evicted
    expect(decorator.getCachedPage('book-1', 75)).toBeDefined(); // pre-warmed
  });

  it('triggers asynchronous background backward prefetch (+25 pages) when within 10 pages of the left edge', async () => {
    // Bootstrap starting further ahead so left margin is available: page 70 -> window [50 .. 99]
    await decorator.getBookPages('book-1', 70, 1);
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(1);

    const bounds = decorator.getWindowBounds();
    expect(bounds.start).toBe(50);
    expect(bounds.end).toBe(99);

    // Request page 55 (distance to left edge: 55 - 50 = 5 <= 10)
    const pages = await decorator.getBookPages('book-1', 55, 1);
    expect(pages[0]?.pageNumber).toBe(55);

    // Allow background async promise to tick
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Backward expansion should be fired for 25 pages [25 .. 49]
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(2);
    const backwardCall = mockInner.getBookPagesMock.mock.calls[1];
    expect(backwardCall?.[1]).toBe(25); // 50 - 25
    expect(backwardCall?.[2]).toBe(25);

    expect(decorator.cacheSize).toBe(50);
    const updatedBounds = decorator.getWindowBounds();
    expect(updatedBounds.start).toBe(25);
    expect(updatedBounds.end).toBe(74);
    expect(decorator.getCachedPage('book-1', 99)).toBeUndefined(); // evicted forward
    expect(decorator.getCachedPage('book-1', 25)).toBeDefined(); // pre-warmed backward
  });

  it('enforces direction locking to prevent duplicate concurrent prefetch calls when holding PageDown', async () => {
    // Slow down backend to keep prefetch in-flight
    let resolveSlowFetch: ((pages: DocumentPage[]) => void) | undefined;
    const slowPromise = new Promise<DocumentPage[]>((res) => {
      resolveSlowFetch = res;
    });

    await decorator.getBookPages('book-1', 20, 1);
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(1);

    mockInner.getBookPagesMock.mockImplementationOnce(() => slowPromise);

    // Request page 42 -> triggers forward prefetch
    await decorator.getBookPages('book-1', 42, 1);
    expect(decorator.inFlightDirection).toBe('forward');

    // Rapidly request pages 43 and 44 while prefetch is in-flight
    await decorator.getBookPages('book-1', 43, 1);
    await decorator.getBookPages('book-1', 44, 1);

    // No duplicate calls spawned!
    expect(mockInner.getBookPagesMock).toHaveBeenCalledTimes(2);

    // Complete the in-flight prefetch
    const resultPages: DocumentPage[] = [];
    for (let p = 51; p <= 75; p++) {
      resultPages.push({
        pageNumber: p,
        chapterTitle: 'Ch',
        paragraphs: ['Text'],
        cfiBase: 'base',
      });
    }
    resolveSlowFetch?.(resultPages);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(decorator.inFlightDirection).toBeNull();
  });

  it('aborts in-flight prefetch via AbortController and resets window when a jump navigation occurs', async () => {
    let prefetchResolve: ((pages: DocumentPage[]) => void) | undefined;
    const pendingPrefetch = new Promise<DocumentPage[]>((res) => {
      prefetchResolve = res;
    });

    await decorator.getBookPages('book-1', 20, 1); // window [1 .. 50]

    mockInner.getBookPagesMock.mockImplementationOnce(() => pendingPrefetch);
    await decorator.getBookPages('book-1', 45, 1); // triggers in-flight forward prefetch
    expect(decorator.inFlightDirection).toBe('forward');

    // Jump navigation to page 180 (far outside current window)
    mockInner.getBookPagesMock.mockImplementation(async (_h, s, c) => {
      const res: DocumentPage[] = [];
      for (let i = s; i < s + c; i++) {
        res.push({
          pageNumber: i,
          chapterTitle: `Chapter ${i}`,
          paragraphs: [`Jump page ${i}`],
          cfiBase: `cfi-${i}`,
        });
      }
      return res;
    });

    const jumpPages = await decorator.getBookPages('book-1', 180, 1);
    expect(jumpPages[0]?.pageNumber).toBe(180);

    // Window was reset and re-centered around 180 (160 .. 209)
    const bounds = decorator.getWindowBounds();
    expect(bounds.start).toBe(160); // 180 - 20
    expect(bounds.end).toBe(209);

    // Resolve old prefetch; it should be discarded because signal was aborted
    prefetchResolve?.([]);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(decorator.getWindowBounds().start).toBe(160);
  });

  it('resets cache and window when switching books', async () => {
    await decorator.getBookPages('book-1', 10, 1);
    expect(decorator.cacheSize).toBeGreaterThan(0);
    expect(decorator.getWindowBounds().start).not.toBeNull();

    // Switch to book-2
    await decorator.getBookPages('book-2', 5, 1);
    expect(decorator.getCachedPage('book-1', 10)).toBeUndefined();
    expect(decorator.getCachedPage('book-2', 5)).toBeDefined();
  });

  it('delegates pass-through IReaderService methods transparently', async () => {
    const bytes = await decorator.readBookBinary('book-1');
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(mockInner.readBookBinaryMock).toHaveBeenCalledWith('book-1');

    const progress = await decorator.updateBookProgress('book-1', 10, 100);
    expect(progress.currentPage).toBe(10);
    expect(mockInner.updateBookProgressMock).toHaveBeenCalledWith('book-1', 10, 100, 0);

    const path = await decorator.getBookFilePath('book-1');
    expect(path).toBe('/path/to/book.epub');
    expect(mockInner.getBookFilePathMock).toHaveBeenCalledWith('book-1');

    const llmReq = await decorator.buildTermLookupRequest(
      {
        bookTitle: 'Title',
        selectedText: 'word',
        surroundingContext: 'ctx',
      },
      'pt-BR'
    );
    expect(llmReq.systemPrompt).toBe('System');
    expect(mockInner.buildTermLookupRequestMock).toHaveBeenCalled();
  });
});
