import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type {
  DocumentPage,
  IHighlightService,
  ILibraryService,
  IPresenceService,
  IReaderService,
  ISettingsService,
  ImportLibraryBookInput,
  LLMRequest,
  PresenceHealthStatus,
  ReadingContext,
} from '../../core/ports';

export class MockBackend
  implements ILibraryService, IHighlightService, IReaderService, IPresenceService, ISettingsService
{
  private readonly books = new Map<string, BookMetadata>();
  private readonly highlights = new Map<string, Highlight>();
  private readonly settings = new Map<string, string>();
  public syncedBooks: string[] = [];
  public startupBook: BookMetadata | null = null;

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

  public async getStartupBook(): Promise<BookMetadata | null> {
    const book = this.startupBook;
    this.startupBook = null;
    return book;
  }

  public async openBookFile(filePath: string): Promise<BookMetadata> {
    const cleanTitle =
      filePath
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') ?? 'Opened File';
    const bookHash = `sha256-path-${cleanTitle.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date();
    const metadata: BookMetadata = {
      bookHash,
      title: cleanTitle,
      author: 'Local File',
      format: filePath.endsWith('.pdf') ? 'pdf' : 'epub',
      currentPage: 1,
      totalPages: 100,
      percentage: 1,
      lastReadAt: now,
      updatedAt: now,
    };
    this.books.set(bookHash, metadata);
    return metadata;
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

  public async renameBook(bookHash: string, newTitle: string): Promise<BookMetadata> {
    const existing = this.books.get(bookHash);
    if (!existing) {
      throw new Error(`Book not found: ${bookHash}`);
    }
    const updated: BookMetadata = {
      ...existing,
      title: newTitle,
      updatedAt: new Date(),
    };
    this.books.set(bookHash, updated);
    return updated;
  }

  public async deleteBook(bookHash: string): Promise<boolean> {
    const removed = this.books.delete(bookHash);
    for (const [id, hl] of Array.from(this.highlights.entries())) {
      if (hl.bookHash === bookHash) {
        this.highlights.delete(id);
      }
    }
    return removed;
  }

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    return Array.from(this.highlights.values()).filter((h) => h.bookHash === bookHash);
  }

  public async loadAllHighlights(): Promise<Highlight[]> {
    return Array.from(this.highlights.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
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

  public async getAppSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  public async setAppSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  public async setDiscordPresenceEnabled(enabled: boolean): Promise<void> {
    this.settings.set('discord_presence_enabled', String(enabled));
  }

  public async clearRichPresence(): Promise<void> {
    this.settings.set('discord_presence_cleared', 'true');
  }

  public async updateLibraryPresence(totalBooks: number): Promise<void> {
    this.settings.set('discord_presence_library', String(totalBooks));
  }

  public async updateAnnotationsPresence(totalAnnotations: number): Promise<void> {
    this.settings.set('discord_presence_annotations', String(totalAnnotations));
  }

  public async getDiscordPresenceHealth(): Promise<PresenceHealthStatus> {
    const isEnabled = this.settings.get('discord_presence_enabled') !== 'false';
    return {
      ok: isEnabled,
      message: isEnabled
        ? 'Connected to Discord client'
        : 'Discord Rich Presence is disabled in settings',
    };
  }
}
