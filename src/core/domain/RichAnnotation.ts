import type { Highlight } from './Highlight';
import type { RichAnnotationType } from './types';

export interface IAnnotationVisitor<R = void> {
  visitAssistedText(annotation: AssistedTextAnnotation): R;
  visitTldrawBoard(annotation: TldrawBoardAnnotation): R;
  visitDrawioDiagram(annotation: DrawioDiagramAnnotation): R;
}

export interface IRichAnnotation {
  readonly type: RichAnnotationType;
  readonly rawData: string;
  readonly svgPreview?: string;
  readonly updatedAt: Date;
  /** Visitor Pattern: permite exportar, renderizar ou indexar sem switch/case de tipos */
  accept<R>(visitor: IAnnotationVisitor<R>): R;
  /** Double Dispatch: a própria classe de anotação sabe se vincular/atualizar no Highlight */
  attachTo(highlight: Highlight): void;
}

export class AssistedTextAnnotation implements IRichAnnotation {
  public readonly type = 'assisted-markdown' as const;
  public readonly svgPreview?: string;

  constructor(
    public readonly rawData: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitAssistedText(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
    highlight.updateNote(this.rawData);
  }
}

export class TldrawBoardAnnotation implements IRichAnnotation {
  public readonly type = 'tldraw' as const;

  constructor(
    public readonly rawData: string,
    public readonly svgPreview?: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitTldrawBoard(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
  }
}

export class DrawioDiagramAnnotation implements IRichAnnotation {
  public readonly type = 'drawio' as const;

  constructor(
    public readonly rawData: string,
    public readonly svgPreview?: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitDrawioDiagram(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
  }
}
