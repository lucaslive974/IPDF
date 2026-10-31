export interface ReadingContext {
  bookTitle: string;
  bookAuthor: string;
  chapterTitle?: string;
  selectedText: string;
  surroundingContext: string;
}

export interface LLMRequest {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}

export interface TermDefinition {
  term: string;
  shortMeaningInContext: string;
  detailedDefinition: string;
  etymologyOrOriginal?: string;
  synonymsInContext: string[];
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  translatorNotes?: string;
}

export interface ILLMProvider {
  readonly providerName: string;
  generateText(request: LLMRequest, signal?: AbortSignal): Promise<string>;
  generateStructured<T>(
    request: LLMRequest,
    jsonSchema?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T>;
  streamText(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string>;
}
