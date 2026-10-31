import { useCallback, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import type { StudyDocumentDescriptor } from './studyWorkbenchTypes';

export interface StudyAssistantHook {
  readonly llmPromptPreview: string;
  readonly syncExportPreview: string;
  generateContextualPrompt(
    document: StudyDocumentDescriptor,
    activeHighlight?: Highlight | null,
    customText?: string
  ): Promise<void>;
  runCloudlessSync(bookHash: string): Promise<void>;
}

export function useStudyAssistant(): StudyAssistantHook {
  const { backendGateway } = useServiceContainer();
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');

  const generateContextualPrompt = useCallback(
    async (
      document: StudyDocumentDescriptor,
      activeHighlight?: Highlight | null,
      customText?: string
    ) => {
      const textToQuery = customText ?? activeHighlight?.text ?? 'noesis';
      const req = await backendGateway.buildTermLookupRequest(
        {
          bookTitle: document.bookTitle,
          bookAuthor: document.bookAuthor,
          chapterTitle: document.chapterTitle,
          selectedText: textToQuery,
          surroundingContext: document.sampleParagraph,
        },
        'en'
      );
      setLlmPromptPreview(JSON.stringify(req, null, 2));
    },
    [backendGateway]
  );

  const runCloudlessSync = useCallback(
    async (bookHash: string) => {
      const exportedJson = await backendGateway.syncBookWorkspace(bookHash);
      setSyncExportPreview(exportedJson);
    },
    [backendGateway]
  );

  return {
    llmPromptPreview,
    syncExportPreview,
    generateContextualPrompt,
    runCloudlessSync,
  };
}
