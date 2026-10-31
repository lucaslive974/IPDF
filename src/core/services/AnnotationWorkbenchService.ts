import { Highlight } from '../domain/Highlight';
import type { IAnnotationVisitor } from '../domain/RichAnnotation';
import type { AnnotationCommand, RichAnnotationType, TextSelection } from '../domain/types';
import type { IAnnotationToolStrategy } from '../ports/IAnnotationStrategy';
import type { IBackendGateway } from '../ports/IBackendGateway';

export class AnnotationWorkbenchService {
  private readonly activeHighlights = new Map<string, Highlight>();
  private readonly toolStrategies = new Map<RichAnnotationType, IAnnotationToolStrategy>();

  constructor(
    private readonly backendGateway: IBackendGateway,
    strategies: IAnnotationToolStrategy[] = []
  ) {
    for (const strategy of strategies) {
      this.registerToolStrategy(strategy);
    }
  }

  public registerToolStrategy(strategy: IAnnotationToolStrategy): void {
    this.toolStrategies.set(strategy.type, strategy);
  }

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    const list = await this.backendGateway.loadBookHighlights(bookHash);
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
          const textStrategy = this.toolStrategies.get('assisted-markdown');
          if (textStrategy) {
            await textStrategy.applyToHighlight(existing, {
              target: 'assisted-markdown',
              action: 'replace-text',
              text: initialNote,
            });
          }
        }
        await this.backendGateway.saveHighlight(existing);
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

    if (initialNote) {
      const textStrategy = this.toolStrategies.get('assisted-markdown');
      if (textStrategy) {
        await textStrategy.applyToHighlight(highlight, {
          target: 'assisted-markdown',
          action: 'replace-text',
          text: initialNote,
        });
      }
    }

    this.activeHighlights.set(id, highlight);
    await this.backendGateway.saveHighlight(highlight);
    return highlight;
  }

  public async interactWithAnnotation(
    highlightId: string,
    toolType: RichAnnotationType,
    command: AnnotationCommand
  ): Promise<Highlight> {
    const highlight = this.activeHighlights.get(highlightId);
    if (!highlight) {
      throw new Error(`Highlight not found: ${highlightId}`);
    }

    const strategy = this.toolStrategies.get(toolType);
    if (!strategy) {
      throw new Error(`Annotation tool strategy not registered: ${toolType}`);
    }

    await strategy.applyToHighlight(highlight, command);
    await this.backendGateway.saveHighlight(highlight);
    return highlight;
  }

  public visitHighlightAnnotations<R>(highlightId: string, visitor: IAnnotationVisitor<R>): R[] {
    const highlight = this.activeHighlights.get(highlightId);
    if (!highlight) {
      throw new Error(`Highlight not found: ${highlightId}`);
    }
    return highlight.acceptAnnotationVisitor(visitor);
  }

  public async removeHighlight(id: string): Promise<void> {
    this.activeHighlights.delete(id);
    await this.backendGateway.deleteHighlight(id);
  }

  public getForPage(pageNumber: number): Highlight[] {
    return Array.from(this.activeHighlights.values()).filter(
      (h) => h.anchor.pageNumber === pageNumber
    );
  }
}
