import type { LLMRequest, ReadingContext } from '../ports/ILLMProvider';

export class PromptBuilder {
  public buildTermLookupRequest(ctx: ReadingContext, targetLang: string): LLMRequest {
    return {
      systemInstruction:
        'You are a philosophical and literary lexicon assistant. Provide accurate contextual definitions.',
      userPrompt: this.formatContextBlock(
        ctx,
        `Define the selected term "${ctx.selectedText}" in ${targetLang} within this specific work's context.`
      ),
      temperature: 0.2,
    };
  }

  public buildTranslationRequest(ctx: ReadingContext, targetLang: string): LLMRequest {
    return {
      systemInstruction:
        'You are a literary and philosophical translator. Preserve nuance and terminology.',
      userPrompt: this.formatContextBlock(
        ctx,
        `Translate the selected passage into ${targetLang}, preserving philosophical precision.`
      ),
      temperature: 0.2,
    };
  }

  public buildPassageExplanationRequest(ctx: ReadingContext, question?: string): LLMRequest {
    const specificDirective = question
      ? `Answer the following study question about the passage: ${question}`
      : 'Provide a deep contextual explanation of the selected passage.';

    return {
      systemInstruction:
        'You are an academic tutor specializing in philosophy and dense literature.',
      userPrompt: this.formatContextBlock(ctx, specificDirective),
      temperature: 0.4,
    };
  }

  private formatContextBlock(ctx: ReadingContext, directive: string): string {
    const chapterLine = ctx.chapterTitle ? `Chapter: ${ctx.chapterTitle}\n` : '';
    return [
      `Book Title: ${ctx.bookTitle}`,
      `Author: ${ctx.bookAuthor}`,
      chapterLine.trimEnd(),
      `Surrounding Paragraph: "${ctx.surroundingContext}"`,
      `Selected Text: "${ctx.selectedText}"`,
      `Task: ${directive}`,
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }
}
