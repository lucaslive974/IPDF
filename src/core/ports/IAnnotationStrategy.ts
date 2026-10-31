import type { Highlight } from '../domain/Highlight';
import type { IRichAnnotation } from '../domain/RichAnnotation';
import type { AnnotationCommand, RichAnnotationType, TextFormatStyle } from '../domain/types';

/**
 * Strategy Pattern que compõe o HighlightManager.
 * Cada implementação (AssistedRichTextStrategy, TldrawAnnotationStrategy, DrawioAnnotationStrategy)
 * encapsula as regras de formatação/desenho e interage com o Highlight via Double Dispatch.
 */
export interface IAnnotationToolStrategy {
  readonly type: RichAnnotationType;

  /**
   * Processa um comando de alto nível (ex: aplicar negrito/sublinhado/cor sem saber Markdown,
   * ou salvar um quadro tldraw/draw.io) e atualiza a anotação no Highlight.
   */
  applyToHighlight(highlight: Highlight, command: AnnotationCommand): Promise<IRichAnnotation>;

  serialize(annotation: IRichAnnotation): string;
  deserialize(rawData: string, updatedAt?: Date, svgPreview?: string): IRichAnnotation;
}

/**
 * Contrato especializado para a estratégia de formatação assistida de texto.
 * Garante que o usuário disponha de ferramentas prontas (negrito, sublinhado, cores, títulos, listas)
 * sem precisar conhecer ou digitar sintaxe Markdown manualmente.
 */
export interface IAssistedTextFormattingStrategy extends IAnnotationToolStrategy {
  readonly type: 'assisted-markdown';
  formatSelection(
    currentContent: string,
    range: { start: number; end: number },
    style: TextFormatStyle
  ): string;
}
