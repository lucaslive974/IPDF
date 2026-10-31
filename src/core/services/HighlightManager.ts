import { Highlight } from '../domain/Highlight';
import type { IAnnotationVisitor } from '../domain/RichAnnotation';
import type { AnnotationCommand, RichAnnotationType, TextSelection } from '../domain/types';
import type { IAnnotationToolStrategy } from '../ports/IAnnotationStrategy';
import type { IHighlightRepository } from '../ports/IRepository';

export class HighlightManager {
  private readonly cache = new Map<string, Highlight>();
  private readonly strategies = new Map<RichAnnotationType, IAnnotationToolStrategy>();

  constructor(
    private readonly repository: IHighlightRepository,
    initialStrategies: IAnnotationToolStrategy[] = []
  ) {
    for (const strategy of initialStrategies) {
      this.registerStrategy(strategy);
    }
  }

  public registerStrategy(strategy: IAnnotationToolStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    this.cache.clear();
    const highlights = await this.repository.findByBook(bookHash);
    for (const highlight of highlights) {
      this.cache.set(highlight.id, highlight);
    }
    return highlights;
  }

  public async createFromSelection(
    bookHash: string,
    selection: TextSelection,
    color: string,
    note = ''
  ): Promise<Highlight> {
    const id = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const highlight = new Highlight(id, bookHash, selection.text, color, selection.anchor, note);
    await this.repository.save(highlight);
    this.cache.set(highlight.id, highlight);
    return highlight;
  }

  public getForPage(pageNumber: number): Highlight[] {
    return Array.from(this.cache.values()).filter(
      (highlight) => highlight.anchor.pageNumber === pageNumber
    );
  }

  public async interactWithAnnotation(
    highlightId: string,
    type: RichAnnotationType,
    command: AnnotationCommand
  ): Promise<Highlight> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No annotation tool strategy registered for type: ${type}`);
    }

    const highlight = this.cache.get(highlightId) ?? (await this.repository.findById(highlightId));
    if (!highlight) {
      throw new Error(`Highlight not found: ${highlightId}`);
    }

    await strategy.applyToHighlight(highlight, command);
    await this.repository.update(highlight);
    this.cache.set(highlight.id, highlight);
    return highlight;
  }

  public visitHighlightAnnotations<R>(highlightId: string, visitor: IAnnotationVisitor<R>): R[] {
    const highlight = this.cache.get(highlightId);
    if (!highlight) {
      throw new Error(`Highlight not found in cache: ${highlightId}`);
    }
    return highlight.acceptAnnotationVisitor(visitor);
  }
}
