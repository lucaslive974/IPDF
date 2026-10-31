import type { Highlight } from '../../src/core/domain/Highlight';
import type {
  IBackendGateway,
  LLMRequest,
  ReadingContext,
} from '../../src/core/ports/IBackendGateway';

export class FakeBackendGateway implements IBackendGateway {
  private readonly highlights = new Map<string, Highlight>();
  public syncedBooks: string[] = [];

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
