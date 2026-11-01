import { beforeEach, describe, expect, it } from 'vitest';
import type { LLMRequest } from '../../../core/ports/IReaderService';
import { createReaderNotesEditorController } from '../../../ui/hooks/useReaderNotesEditor';
import { DEFAULT_DOCUMENT } from '../../../ui/stores/useReaderStore';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderNotesEditor / createReaderNotesEditorController', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  it('formats entire note when range is empty', () => {
    const controller = createReaderNotesEditorController({ readerService: backend });

    const formatted = controller.formatDraft(
      'Important Concept',
      { start: 0, end: 0 },
      { kind: 'bold' }
    );
    expect(formatted).toBe('**Important Concept**');
  });

  it('formats only selected substring when range is provided', () => {
    const controller = createReaderNotesEditorController({ readerService: backend });

    const formatted = controller.formatDraft(
      'This is critical information',
      { start: 8, end: 16 },
      { kind: 'italic' }
    );
    expect(formatted).toBe('This is *critical* information');
  });

  it('builds contextual LLM prompt with selected highlight or fallback text', async () => {
    const controller = createReaderNotesEditorController({ readerService: backend });

    const prompt1 = (await controller.buildPrompt(
      DEFAULT_DOCUMENT,
      'categorical imperative'
    )) as LLMRequest;

    expect(prompt1.systemPrompt).toContain('categorical imperative');
    expect(prompt1.systemPrompt).toContain('Lang: en');

    const prompt2 = (await controller.buildPrompt(
      DEFAULT_DOCUMENT,
      null,
      'custom question'
    )) as LLMRequest;

    expect(prompt2.systemPrompt).toContain('custom question');
  });
});
