import type { Highlight } from '../domain/Highlight';
import type { IRichAnnotation } from '../domain/RichAnnotation';
import type { AnnotationCommand, RichAnnotationType, TextFormatStyle } from '../domain/types';

export interface IAnnotationToolStrategy {
  readonly type: RichAnnotationType;
  applyToHighlight(highlight: Highlight, command: AnnotationCommand): Promise<IRichAnnotation>;
  serialize(annotation: IRichAnnotation): string;
  deserialize(rawData: string, updatedAt?: Date, svgPreview?: string): IRichAnnotation;
}

export interface IAssistedTextFormattingStrategy extends IAnnotationToolStrategy {
  readonly type: 'assisted-markdown';
  formatSelection(
    currentContent: string,
    range: { start: number; end: number },
    style: TextFormatStyle
  ): string;
}
