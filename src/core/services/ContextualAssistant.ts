import type {
  ILLMProvider,
  ReadingContext,
  TermDefinition,
  TranslationResult,
} from '../ports/ILLMProvider';
import { PromptBuilder } from './PromptBuilder';

export class ContextualAssistant {
  private currentAbortController: AbortController | null = null;

  constructor(
    private readonly llmProvider: ILLMProvider,
    private readonly promptBuilder: PromptBuilder = new PromptBuilder()
  ) {}

  public async lookupTerm(ctx: ReadingContext, targetLang: string): Promise<TermDefinition> {
    const signal = this.renewAbortSignal();
    const request = this.promptBuilder.buildTermLookupRequest(ctx, targetLang);
    return this.llmProvider.generateStructured<TermDefinition>(request, undefined, signal);
  }

  public async translateInPlace(
    ctx: ReadingContext,
    targetLang: string
  ): Promise<TranslationResult> {
    const signal = this.renewAbortSignal();
    const request = this.promptBuilder.buildTranslationRequest(ctx, targetLang);
    return this.llmProvider.generateStructured<TranslationResult>(request, undefined, signal);
  }

  public async explainPassage(
    ctx: ReadingContext,
    onChunk: (chunk: string) => void,
    question?: string
  ): Promise<string> {
    const signal = this.renewAbortSignal();
    const request = this.promptBuilder.buildPassageExplanationRequest(ctx, question);
    return this.llmProvider.streamText(request, onChunk, signal);
  }

  public cancelPendingRequest(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  private renewAbortSignal(): AbortSignal {
    this.cancelPendingRequest();
    this.currentAbortController = new AbortController();
    return this.currentAbortController.signal;
  }
}
