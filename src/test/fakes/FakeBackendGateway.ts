import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type {
  IBackendGateway,
  ImportLibraryBookInput,
  LLMRequest,
  ReadingContext,
} from '../../core/ports/IBackendGateway';

export class FakeBackendGateway implements IBackendGateway {
  private readonly books = new Map<string, BookMetadata>();
  private readonly highlights = new Map<string, Highlight>();
  public syncedBooks: string[] = [];

  public async listLibraryBooks(): Promise<BookMetadata[]> {
    return Array.from(this.books.values()).sort(
      (a, b) => b.lastReadAt.getTime() - a.lastReadAt.getTime()
    );
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
    const safeTotal = Math.max(1, totalPages);
    const updated: BookMetadata = {
      bookHash,
      title: existing?.title ?? 'Untitled',
      author: existing?.author ?? 'Unknown',
      format: existing?.format ?? 'epub',
      currentPage,
      totalPages: safeTotal,
      percentage: Math.round((currentPage / safeTotal) * 100),
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
      systemPrompt: `Target language: ${targetLanguage}`,
      userPrompt: `${context.bookTitle} - ${context.selectedText}`,
      temperature: 0.3,
      maxTokens: 500,
    };
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    this.syncedBooks.push(bookHash);
    const items = await this.loadBookHighlights(bookHash);
    return JSON.stringify({ bookHash, count: items.length });
  }
}
