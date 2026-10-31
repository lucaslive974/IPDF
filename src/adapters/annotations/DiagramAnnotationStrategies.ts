import type { Highlight } from '../../core/domain/Highlight';
import {
  type IRichAnnotation,
  createDrawioDiagramAnnotation,
  createTldrawBoardAnnotation,
} from '../../core/domain/RichAnnotation';
import type { AnnotationCommand, DrawioCommand, TldrawCommand } from '../../core/domain/types';
import type { IAnnotationToolStrategy } from '../../core/ports/IAnnotationStrategy';

type TldrawHandlerMap = {
  [K in TldrawCommand['action']]: (command: Extract<TldrawCommand, { action: K }>) => string;
};

type DrawioHandlerMap = {
  [K in DrawioCommand['action']]: (command: Extract<DrawioCommand, { action: K }>) => string;
};

export class TldrawAnnotationStrategy implements IAnnotationToolStrategy {
  public readonly type = 'tldraw' as const;

  private readonly commandHandlers: TldrawHandlerMap = {
    'save-snapshot': (command) => command.snapshotJson,
    'clear-canvas': () => '{}',
  };

  public async applyToHighlight(
    highlight: Highlight,
    command: AnnotationCommand
  ): Promise<IRichAnnotation> {
    if (command.target !== 'tldraw') {
      throw new Error(`Invalid command target for TldrawAnnotationStrategy: ${command.target}`);
    }

    const rawData = this.dispatchCommand(command);
    const annotation = createTldrawBoardAnnotation(rawData, command.svgPreview, new Date());
    highlight.setRichAnnotation(annotation);
    return annotation;
  }

  public serialize(annotation: IRichAnnotation): string {
    return annotation.rawData;
  }

  public deserialize(
    rawData: string,
    updatedAt: Date = new Date(),
    svgPreview?: string
  ): IRichAnnotation {
    return createTldrawBoardAnnotation(rawData, svgPreview, updatedAt);
  }

  private dispatchCommand<K extends TldrawCommand['action']>(
    command: Extract<TldrawCommand, { action: K }>
  ): string {
    const handler = this.commandHandlers[command.action] as TldrawHandlerMap[K];
    return handler(command);
  }
}

export class DrawioAnnotationStrategy implements IAnnotationToolStrategy {
  public readonly type = 'drawio' as const;

  private readonly commandHandlers: DrawioHandlerMap = {
    'save-diagram': (command) => command.xmlOrJsonDiagram,
    'clear-diagram': () => '<mxGraphModel/>',
  };

  public async applyToHighlight(
    highlight: Highlight,
    command: AnnotationCommand
  ): Promise<IRichAnnotation> {
    if (command.target !== 'drawio') {
      throw new Error(`Invalid command target for DrawioAnnotationStrategy: ${command.target}`);
    }

    const rawData = this.dispatchCommand(command);
    const annotation = createDrawioDiagramAnnotation(rawData, command.svgPreview, new Date());
    highlight.setRichAnnotation(annotation);
    return annotation;
  }

  public serialize(annotation: IRichAnnotation): string {
    return annotation.rawData;
  }

  public deserialize(
    rawData: string,
    updatedAt: Date = new Date(),
    svgPreview?: string
  ): IRichAnnotation {
    return createDrawioDiagramAnnotation(rawData, svgPreview, updatedAt);
  }

  private dispatchCommand<K extends DrawioCommand['action']>(
    command: Extract<DrawioCommand, { action: K }>
  ): string {
    const handler = this.commandHandlers[command.action] as DrawioHandlerMap[K];
    return handler(command);
  }
}
