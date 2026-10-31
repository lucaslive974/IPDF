import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type {
  BackendService,
  DocumentPage,
  ImportLibraryBookInput,
  LLMRequest,
  ReadingContext,
} from '../../core/ports/BackendService';

export class MockBackend implements BackendService {
  private readonly books = new Map<string, BookMetadata>();
  private readonly highlights = new Map<string, Highlight>();
  public syncedBooks: string[] = [];

  constructor(initialBooks: BookMetadata[] = [], initialHighlights: Highlight[] = []) {
    for (const b of initialBooks) {
      this.books.set(b.bookHash, b);
    }
    for (const h of initialHighlights) {
      this.highlights.set(h.id, h);
    }
  }

  public async listLibraryBooks(): Promise<BookMetadata[]> {
    return Array.from(this.books.values()).sort(
      (a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime()
    );
  }

  public async readBookBinary(_bookHash: string): Promise<Uint8Array> {
    return new TextEncoder().encode(
      JSON.stringify({
        chapters: [
          {
            title: 'Book VII — Allegory of the Cave',
            cfiBase: 'epubcfi(/6/14!/4/2',
            content:
              'Behold! human beings living in an underground den, which has a mouth open towards the light and reaching all along the den; here they have been from their childhood, and have their legs and necks chained so that they cannot move, and can only see before them, being prevented by the chains from turning round their heads (noesis vs. doxa).',
          },
        ],
      })
    );
  }

  public async getBookPages(
    _bookHash: string,
    startPage: number,
    count: number
  ): Promise<DocumentPage[]> {
    const pages: DocumentPage[] = [];
    for (let i = 0; i < count; i += 1) {
      const pageNum = startPage + i;
      pages.push({
        pageNumber: pageNum,
        chapterTitle: 'Book VII — Allegory of the Cave',
        paragraphs: [
          'Behold! human beings living in an underground den, which has a mouth open towards the light and reaching all along the den; here they have been from their childhood, and have their legs and necks chained so that they cannot move, and can only see before them, being prevented by the chains from turning round their heads (noesis vs. doxa).',
        ],
        cfiBase: `epubcfi(/6/14!/4/2/${pageNum})`,
      });
    }
    return pages;
  }

  public async importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata> {
    const bookHash = `sha256-${input.title.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date();
    const metadata: BookMetadata = {
      bookHash,
      title: input.title,
      author: input.author,
      format: input.format,
      currentPage: 1,
      totalPages: Math.max(1, input.totalPages),
      percentage: Math.round((1 / Math.max(1, input.totalPages)) * 100),
      coverImageUrl: input.coverImageUrl,
      lastReadAt: now,
      updatedAt: now,
    };
    this.books.set(bookHash, metadata);
    return metadata;
  }

  public async updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number
  ): Promise<BookMetadata> {
    const existing = this.books.get(bookHash);
    const now = new Date();
    const updated: BookMetadata = {
      bookHash,
      title: existing?.title ?? 'The Republic',
      author: existing?.author ?? 'Plato',
      format: existing?.format ?? 'epub',
      currentPage,
      totalPages,
      percentage: Math.round((currentPage / totalPages) * 100),
      coverImageUrl: existing?.coverImageUrl,
      lastReadAt: now,
      updatedAt: now,
    };
    this.books.set(bookHash, updated);
    return updated;
  }

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    return Array.from(this.highlights.values()).filter((h) => h.bookHash === bookHash);
  }

  public async saveHighlight(highlight: Highlight): Promise<void> {
    this.highlights.set(highlight.id, highlight);
  }

  public async deleteHighlight(highlightId: string): Promise<void> {
    this.highlights.delete(highlightId);
  }

  public async buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage = 'en'
  ): Promise<LLMRequest> {
    return {
      systemPrompt: `Analyze philosophical term "${context.selectedText}" in context of "${context.bookTitle}" (Lang: ${targetLanguage}).`,
      userPrompt: `Explain "${context.selectedText}" within: "${context.surroundingContext}"`,
      temperature: 0.2,
      maxTokens: 400,
    };
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    this.syncedBooks.push(bookHash);
    const highlights = await this.loadBookHighlights(bookHash);
    return JSON.stringify({
      schemaVersion: 1,
      engine: 'ipdf-core (Mock Sync)',
      bookHash,
      highlightsCount: highlights.length,
      highlights,
    });
  }
}
