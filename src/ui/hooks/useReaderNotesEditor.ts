import type { TextFormatStyle } from '@domain/types';
import type { IReaderService } from '@ports/IReaderService';
import { useReader } from '@providers/ReaderContext';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { type StudyDocumentDescriptor, useReaderStore } from '@stores/useReaderStore';
import { formatMarkdownSelection } from '@utils/markdownFormatting';
import { useCallback, useMemo, useState } from 'react';

export interface ReaderNotesEditorState {
  readonly noteInput: string;
  readonly llmPromptPreview: string;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  generateContextualPrompt(customText?: string): Promise<void>;
}

export interface ReaderNotesEditorDependencies {
  readonly readerService: IReaderService;
}

export interface ReaderNotesEditorController {
  formatDraft(
    currentNote: string,
    range: { start: number; end: number },
    style: TextFormatStyle
  ): string;
  buildPrompt(
    document: StudyDocumentDescriptor,
    selectedHighlightText: string | null,
    customText?: string
  ): Promise<unknown>;
}

export function createReaderNotesEditorController(
  deps: ReaderNotesEditorDependencies
): ReaderNotesEditorController {
  return {
    formatDraft(currentNote, range, style) {
      const activeRange = range.end > range.start ? range : { start: 0, end: currentNote.length };
      return formatMarkdownSelection(currentNote, activeRange, style);
    },

    async buildPrompt(document, selectedHighlightText, customText) {
      const textToQuery = customText ?? selectedHighlightText ?? 'noesis';
      return await deps.readerService.buildTermLookupRequest(
        {
          bookTitle: document.bookTitle,
          bookAuthor: document.bookAuthor,
          chapterTitle: document.chapterTitle,
          selectedText: textToQuery,
          surroundingContext: document.sampleParagraph,
        },
        'en'
      );
    },
  };
}

export function useReaderNotesEditor(): ReaderNotesEditorState {
  const { highlights: readerHighlights } = useReader();
  const { readerService } = useServiceContainer();
  const document = useReaderStore((s) => s.document);
  const highlights = useHighlightStore((s) => s.highlights);
  const selectedId = useHighlightStore((s) => s.selectedHighlightId);
  const noteInput = useHighlightStore((s) => s.noteInput);
  const setNoteInput = useHighlightStore((s) => s.setNoteInput);

  const controller = useMemo(
    () => createReaderNotesEditorController({ readerService }),
    [readerService]
  );

  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const updateNoteDraft = useCallback(
    (value: string) => {
      setNoteInput(value);
      if (selectedId) {
        void readerHighlights.updateHighlightNote(selectedId, value);
      }
    },
    [readerHighlights, selectedId, setNoteInput]
  );

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle) => {
      if (!selectedId) return;

      const formatted = controller.formatDraft(noteInput, selectionRange, style);
      setNoteInput(formatted);
      setSelectionRange({ start: 0, end: 0 });
      await readerHighlights.updateHighlightNote(selectedId, formatted);
    },
    [controller, noteInput, readerHighlights, selectedId, selectionRange, setNoteInput]
  );

  const generateContextualPrompt = useCallback(
    async (customText?: string) => {
      const active = highlights.find((h) => h.id === selectedId);
      const req = await controller.buildPrompt(document, active?.text ?? null, customText);
      setLlmPromptPreview(JSON.stringify(req, null, 2));
    },
    [controller, document, highlights, selectedId]
  );

  return {
    noteInput,
    llmPromptPreview,
    updateNoteDraft,
    updateSelectionRange,
    applyAssistedFormat,
    generateContextualPrompt,
  };
}
