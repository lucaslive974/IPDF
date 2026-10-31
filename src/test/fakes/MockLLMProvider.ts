import type { ILLMProvider, LLMRequest } from '../../core/ports/ILLMProvider';

export class MockLLMProvider implements ILLMProvider {
  public readonly providerName = 'MockLLMProvider';
  public lastRequest: LLMRequest | null = null;
  public lastSignals: AbortSignal[] = [];
  public simulatedDelayMs = 0;
  public structuredResponse: unknown = {};
  public streamedChunks: string[] = ['Chunk 1 ', 'Chunk 2'];

  public async generateText(request: LLMRequest, signal?: AbortSignal): Promise<string> {
    this.lastRequest = request;
    if (signal) {
      this.lastSignals.push(signal);
    }
    await this.waitWithSignal(signal);
    return 'Generated text response';
  }

  public async generateStructured<T>(
    request: LLMRequest,
    _jsonSchema?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T> {
    this.lastRequest = request;
    if (signal) {
      this.lastSignals.push(signal);
    }
    await this.waitWithSignal(signal);
    return this.structuredResponse as T;
  }

  public async streamText(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    this.lastRequest = request;
    if (signal) {
      this.lastSignals.push(signal);
    }
    await this.waitWithSignal(signal);

    let full = '';
    for (const chunk of this.streamedChunks) {
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }
      full += chunk;
      onChunk(chunk);
    }
    return full;
  }

  private async waitWithSignal(signal?: AbortSignal): Promise<void> {
    if (this.simulatedDelayMs <= 0) {
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve();
      }, this.simulatedDelayMs);

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('Request aborted'));
        },
        { once: true }
      );
    });
  }
}
