import { Highlight } from '../domain/Highlight';
import type { TextSelection } from '../domain/types';
import type { IHighlightService } from '../ports/IHighlightService';

export class AnnotationWorkbenchService {
  private readonly activeHighlights = new Map<string, Highlight>();

  constructor(private readonly highlightService: IHighlightService) {}

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    const list = await this.highlightService.loadBookHighlights(bookHash);
    this.activeHighlights.clear();
    for (const h of list) {
      this.activeHighlights.set(h.id, h);
    }
    return list;
  }

  public async createFromSelection(
    bookHash: string,
    selection: TextSelection,
    color = '#FFEB3B',
    initialNote = ''
  ): Promise<Highlight> {
    for (const existing of this.activeHighlights.values()) {
      if (existing.overlapsWith(selection.anchor)) {
        existing.changeColor(color);
        if (initialNote) {
          existing.updateNote(initialNote);
        }
        await this.highlightService.saveHighlight(existing);
        return existing;
      }
    }

    const id = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const highlight = new Highlight(
      id,
      bookHash,
      selection.text,
      color,
      selection.anchor,
      initialNote
    );

    this.activeHighlights.set(id, highlight);
    await this.highlightService.saveHighlight(highlight);
    return highlight;
  }

  public async updateHighlightNote(highlightId: string, note: string): Promise<Highlight> {
    const highlight = this.activeHighlights.get(highlightId);
    if (!highlight) {
      throw new Error(`Highlight not found: ${highlightId}`);
    }

    highlight.updateNote(note);
    await this.highlightService.saveHighlight(highlight);
    return highlight;
  }

  public async updateHighlightColor(highlightId: string, color: string): Promise<Highlight> {
    const highlight = this.activeHighlights.get(highlightId);
    if (!highlight) {
      throw new Error(`Highlight not found: ${highlightId}`);
    }

    highlight.changeColor(color);
    await this.highlightService.saveHighlight(highlight);
    return highlight;
  }

  public async removeHighlight(id: string): Promise<void> {
    this.activeHighlights.delete(id);
    await this.highlightService.deleteHighlight(id);
  }

  public getForPage(pageNumber: number): Highlight[] {
    return Array.from(this.activeHighlights.values()).filter(
      (h) => h.anchor.pageNumber === pageNumber
    );
  }
}
