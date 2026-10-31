import { describe, expect, it } from 'vitest';
import { MockLLMProvider } from '../../test/fakes/MockLLMProvider';
import type { ReadingContext, TermDefinition } from '../ports/ILLMProvider';
import { ContextualAssistant } from './ContextualAssistant';
import { PromptBuilder } from './PromptBuilder';

describe('PromptBuilder & ContextualAssistant', () => {
  const sampleContext: ReadingContext = {
    bookTitle: 'The Republic',
    bookAuthor: 'Plato',
    chapterTitle: 'Book VI - The Divided Line',
    selectedText: 'noesis',
    surroundingContext:
      'At the highest segment of the intelligible realm, the soul uses noesis to grasp the Forms directly.',
  };

  it('PromptBuilder includes title, author, chapter, surroundingContext, and selectedText', async () => {
    const mockLLM = new MockLLMProvider();
    const definitionFixture: TermDefinition = {
      term: 'noesis',
      shortMeaningInContext: 'Direct intellectual apprehension of the Forms',
      detailedDefinition: 'Highest cognitive activity in Plato’s Divided Line.',
      etymologyOrOriginal: 'νόησις',
      synonymsInContext: ['intellection', 'pure reason'],
    };
    mockLLM.structuredResponse = definitionFixture;

    const assistant = new ContextualAssistant(mockLLM, new PromptBuilder());
    const result = await assistant.lookupTerm(sampleContext, 'pt-BR');

    expect(result).toEqual(definitionFixture);
    expect(mockLLM.lastRequest).not.toBeNull();
    expect(mockLLM.lastRequest?.userPrompt).toContain('Plato');
    expect(mockLLM.lastRequest?.userPrompt).toContain('The Republic');
    expect(mockLLM.lastRequest?.userPrompt).toContain('Book VI - The Divided Line');
    expect(mockLLM.lastRequest?.userPrompt).toContain(sampleContext.surroundingContext);
    expect(mockLLM.lastRequest?.userPrompt).toContain('noesis');
  });

  it('aborts the previous pending request when a new lookupTerm or explainPassage call is made', async () => {
    const mockLLM = new MockLLMProvider();
    mockLLM.simulatedDelayMs = 50;
    const assistant = new ContextualAssistant(mockLLM);

    const firstCallPromise = assistant.lookupTerm(sampleContext, 'pt-BR');
    // Immediately fire a second request before the first finishes
    const chunks: string[] = [];
    const secondCallPromise = assistant.explainPassage(
      sampleContext,
      (chunk) => chunks.push(chunk),
      'How does noesis differ from dianoia?'
    );

    await expect(firstCallPromise).rejects.toThrow('Request aborted');
    const explanation = await secondCallPromise;

    expect(mockLLM.lastSignals).toHaveLength(2);
    expect(mockLLM.lastSignals[0].aborted).toBe(true);
    expect(mockLLM.lastSignals[1].aborted).toBe(false);
    expect(explanation).toBe('Chunk 1 Chunk 2');
    expect(chunks).toEqual(['Chunk 1 ', 'Chunk 2']);
  });
});
