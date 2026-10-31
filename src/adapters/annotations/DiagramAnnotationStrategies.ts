import type { Highlight } from '../../core/domain/Highlight';
import {
  DrawioDiagramAnnotation,
  type IRichAnnotation,
  TldrawBoardAnnotation,
} from '../../core/domain/RichAnnotation';
import type { AnnotationCommand } from '../../core/domain/types';
import type { IAnnotationToolStrategy } from '../../core/ports/IAnnotationStrategy';

export class TldrawAnnotationStrategy implements IAnnotationToolStrategy {
  public readonly type = 'tldraw' as const;

  public async applyToHighlight(
    highlight: Highlight,
    command: AnnotationCommand
  ): Promise<IRichAnnotation> {
    if (command.target !== 'tldraw') {
      throw new Error(`Invalid command target for TldrawAnnotationStrategy: ${command.target}`);
    }

    const rawData = command.action === 'clear-canvas' ? '{}' : (command.snapshotJson ?? '{}');
    const annotation = new TldrawBoardAnnotation(rawData, command.svgPreview, new Date());
    annotation.attachTo(highlight);
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
    return new TldrawBoardAnnotation(rawData, svgPreview, updatedAt);
  }
}

export class DrawioAnnotationStrategy implements IAnnotationToolStrategy {
  public readonly type = 'drawio' as const;

  public async applyToHighlight(
    highlight: Highlight,
    command: AnnotationCommand
  ): Promise<IRichAnnotation> {
    if (command.target !== 'drawio') {
      throw new Error(`Invalid command target for DrawioAnnotationStrategy: ${command.target}`);
    }

    const rawData =
      command.action === 'clear-diagram' ? '<mxGraphModel/>' : (command.xmlOrJsonDiagram ?? '');
    const annotation = new DrawioDiagramAnnotation(rawData, command.svgPreview, new Date());
    annotation.attachTo(highlight);
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
    return new DrawioDiagramAnnotation(rawData, svgPreview, updatedAt);
  }
}
