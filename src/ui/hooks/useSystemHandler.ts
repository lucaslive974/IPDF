import {
  type SerializedBookMetadata,
  deserializeBookMetadata,
} from '@adapters/ipc/TauriLibraryService';
import type { BookMetadata } from '@domain/BookMetadata';
import type { ILibraryService } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useEffect } from 'react';

export interface SystemHandlerDependencies {
  readonly libraryService: ILibraryService;
  readonly upsertBook: (book: BookMetadata) => void;
  readonly onOpenBook?: (book: BookMetadata) => void;
}

export interface UseSystemHandlerOptions {
  readonly onOpenBook?: (book: BookMetadata) => void;
}

/**
 * Sets up OS system event listeners for cold start book opening, warm start Tauri events, and file drag-and-drop.
 * Returns a cleanup function that detaches all event listeners.
 */
export function setupSystemEventListeners(deps: SystemHandlerDependencies): () => void {
  let isCancelled = false;

  // 1. Cold Start: Check if app was launched with a book argument from the OS
  void deps.libraryService
    .getStartupBook()
    .then((startupBook) => {
      if (!isCancelled && startupBook) {
        deps.upsertBook(startupBook);
        deps.onOpenBook?.(startupBook);
      }
    })
    .catch((err) => {
      console.error('Failed to retrieve startup book:', err);
    });

  // 2. Warm Start: Listen for single-instance launch events when app is already open
  let unlisten: (() => void) | undefined;
  const setupListener = async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      if (isCancelled) return;

      unlisten = await listen<SerializedBookMetadata>('open-book-from-system', (event) => {
        if (!event.payload) return;
        const book = deserializeBookMetadata(event.payload);
        deps.upsertBook(book);
        deps.onOpenBook?.(book);
      });
    } catch {
      // Not running inside native Tauri runtime (e.g. Vitest or web browser)
    }
  };

  void setupListener();

  // 3. Window Drag and Drop: Native OS file dropped into the window
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'epub' && ext !== 'pdf') return;

    const filePath = (file as unknown as { path?: string }).path;
    if (filePath) {
      try {
        const book = await deps.libraryService.openBookFile(filePath);
        deps.upsertBook(book);
        deps.onOpenBook?.(book);
      } catch (err) {
        console.error('Failed to open dropped file by path:', err);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
  }

  return () => {
    isCancelled = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    }
    if (unlisten) {
      unlisten();
    }
  };
}

export function useSystemHandler(options?: UseSystemHandlerOptions): void {
  const { libraryService } = useServiceContainer();
  const onOpenBook = options?.onOpenBook;
  const upsertBook = useLibraryStore((s) => s.upsertBook);

  useEffect(() => {
    return setupSystemEventListeners({
      libraryService,
      upsertBook,
      onOpenBook,
    });
  }, [libraryService, onOpenBook, upsertBook]);
}
