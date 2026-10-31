import { useEffect } from 'react';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { type StudyDocumentDescriptor, createEmptyRect } from './studyWorkbenchTypes';

export interface StudyLifecycleParams {
  readonly document: StudyDocumentDescriptor;
  readonly loadBooks: () => Promise<unknown>;
  readonly refreshState: (activeHighlightId?: string | null, pageNum?: number) => Promise<void>;
}

export function useStudyLifecycle({
  document,
  loadBooks,
  refreshState,
}: StudyLifecycleParams): void {
  const { annotationWorkbench } = useServiceContainer();

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      await loadBooks();
      if (cancelled) return;

      await annotationWorkbench.loadBookHighlights(document.bookHash);
      if (cancelled) return;

      const existing = annotationWorkbench.getForPage(1);
      if (existing.length === 0) {
        const created = await annotationWorkbench.createFromSelection(
          document.bookHash,
          {
            text: 'noesis vs. doxa',
            surroundingContext: document.sampleParagraph,
            anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/14!/4/2/1:120)' },
            clientRect: createEmptyRect(),
          },
          '#eab308',
          'Transition from sensory opinion to pure intellection'
        );
        if (!cancelled) {
          await refreshState(created.id, 1);
        }
      } else if (!cancelled) {
        await refreshState(existing[0]?.id, 1);
      }
    };

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, [annotationWorkbench, document, loadBooks, refreshState]);
}
