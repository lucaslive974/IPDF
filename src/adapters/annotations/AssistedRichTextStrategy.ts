import type { Highlight } from '../../core/domain/Highlight';
import { AssistedTextAnnotation, type IRichAnnotation } from '../../core/domain/RichAnnotation';
import type { AnnotationCommand, TextFormatStyle } from '../../core/domain/types';
import type { IAssistedTextFormattingStrategy } from '../../core/ports/IAnnotationStrategy';

export class AssistedRichTextStrategy implements IAssistedTextFormattingStrategy {
  public readonly type = 'assisted-markdown' as const;

  public formatSelection(
    currentContent: string,
    range: { start: number; end: number },
    style: TextFormatStyle
  ): string {
    const safeStart = Math.max(0, Math.min(range.start, currentContent.length));
    const safeEnd = Math.max(safeStart, Math.min(range.end, currentContent.length));
    const before = currentContent.slice(0, safeStart);
    const selected = currentContent.slice(safeStart, safeEnd);
    const after = currentContent.slice(safeEnd);

    let formatted = selected;
    switch (style.kind) {
      case 'bold':
        formatted = `**${selected}**`;
        break;
      case 'italic':
        formatted = `*${selected}*`;
        break;
      case 'underline':
        formatted = `<u>${selected}</u>`;
        break;
      case 'strikethrough':
        formatted = `~~${selected}~~`;
        break;
      case 'textColor':
        formatted = `<span style="color:${style.colorHex}">${selected}</span>`;
        break;
      case 'backgroundColor':
        formatted = `<mark style="background-color:${style.colorHex}">${selected}</mark>`;
        break;
      case 'heading':
        formatted = `${'#'.repeat(style.level)} ${selected}`;
        break;
      case 'bulletList':
        formatted = selected
          .split('\n')
          .map((line) => `- ${line}`)
          .join('\n');
        break;
      case 'orderedList':
        formatted = selected
          .split('\n')
          .map((line, index) => `${index + 1}. ${line}`)
          .join('\n');
        break;
      case 'blockquote':
        formatted = selected
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        break;
    }

    return `${before}${formatted}${after}`;
  }

  public async applyToHighlight(
    highlight: Highlight,
    command: AnnotationCommand
  ): Promise<IRichAnnotation> {
    if (command.target !== 'assisted-markdown') {
      throw new Error(`Invalid command target for AssistedRichTextStrategy: ${command.target}`);
    }

    const existing = highlight.getRichAnnotation('assisted-markdown');
    const currentText = existing ? existing.rawData : highlight.note;

    let nextContent = currentText;
    if (command.action === 'replace-text') {
      nextContent = command.text ?? '';
    } else if (command.action === 'insert-text') {
      nextContent = currentText ? `${currentText}\n${command.text ?? ''}` : (command.text ?? '');
    } else if (command.action === 'apply-format' && command.selectionRange && command.formatStyle) {
      nextContent = this.formatSelection(currentText, command.selectionRange, command.formatStyle);
    }

    const annotation = new AssistedTextAnnotation(nextContent, new Date());
    annotation.attachTo(highlight);
    return annotation;
  }

  public serialize(annotation: IRichAnnotation): string {
    return annotation.rawData;
  }

  public deserialize(rawData: string, updatedAt: Date = new Date()): IRichAnnotation {
    return new AssistedTextAnnotation(rawData, updatedAt);
  }
}
