import type { Highlight } from '../../core/domain/Highlight';
import { AssistedTextAnnotation, type IRichAnnotation } from '../../core/domain/RichAnnotation';
import type {
  AnnotationCommand,
  AssistedMarkdownCommand,
  TextFormatStyle,
} from '../../core/domain/types';
import type { IAssistedTextFormattingStrategy } from '../../core/ports/IAnnotationStrategy';

type ActionKind = AssistedMarkdownCommand['action'];
type CommandHandlerMap = {
  [K in ActionKind]: (
    currentText: string,
    command: Extract<AssistedMarkdownCommand, { action: K }>
  ) => string;
};

type StyleKind = TextFormatStyle['kind'];
type StyleFormatterMap = {
  [K in StyleKind]: (selected: string, style: Extract<TextFormatStyle, { kind: K }>) => string;
};

export class AssistedRichTextStrategy implements IAssistedTextFormattingStrategy {
  public readonly type = 'assisted-markdown' as const;

  private readonly styleFormatters: StyleFormatterMap = {
    bold: (selected) => `**${selected}**`,
    italic: (selected) => `*${selected}*`,
    underline: (selected) => `<u>${selected}</u>`,
    strikethrough: (selected) => `~~${selected}~~`,
    textColor: (selected, style) => `<span style="color:${style.colorHex}">${selected}</span>`,
    backgroundColor: (selected, style) =>
      `<mark style="background-color:${style.colorHex}">${selected}</mark>`,
    heading: (selected, style) => `${'#'.repeat(style.level)} ${selected}`,
    bulletList: (selected) =>
      selected
        .split('\n')
        .map((line) => `- ${line}`)
        .join('\n'),
    orderedList: (selected) =>
      selected
        .split('\n')
        .map((line, index) => `${index + 1}. ${line}`)
        .join('\n'),
    blockquote: (selected) =>
      selected
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n'),
  };

  private readonly commandHandlers: CommandHandlerMap = {
    'replace-text': (_currentText, command) => command.text,
    'insert-text': (currentText, command) =>
      currentText ? `${currentText}\n${command.text}` : command.text,
    'apply-format': (currentText, command) =>
      this.formatSelection(currentText, command.selectionRange, command.formatStyle),
  };

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

    const formatted = this.dispatchStyleFormatter(selected, style);
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
    const nextContent = this.dispatchCommand(currentText, command);

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

  private dispatchCommand<K extends ActionKind>(
    currentText: string,
    command: Extract<AssistedMarkdownCommand, { action: K }>
  ): string {
    const handler = this.commandHandlers[command.action] as CommandHandlerMap[K];
    return handler(currentText, command);
  }

  private dispatchStyleFormatter<K extends StyleKind>(
    selected: string,
    style: Extract<TextFormatStyle, { kind: K }>
  ): string {
    const formatter = this.styleFormatters[style.kind] as StyleFormatterMap[K];
    return formatter(selected, style);
  }
}
