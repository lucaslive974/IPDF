import {
  type SerializedBookMetadata,
  deserializeBookMetadata,
} from '@adapters/ipc/TauriLibraryService';
import { useNavigation } from '@providers/NavigationContext';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useEffect } from 'react';

export function useSystemHandler(): void {
  const { libraryService } = useServiceContainer();
  const { openReader } = useNavigation();
  const upsertBook = useLibraryStore((s) => s.upsertBook);

  useEffect(() => {
    let isCancelled = false;

    // 1. Cold Start: Check if app was launched with a book argument from the OS
    void libraryService
      .getStartupBook()
      .then((startupBook) => {
        if (!isCancelled && startupBook) {
          upsertBook(startupBook);
          openReader(startupBook);
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
          upsertBook(book);
          openReader(book);
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
          const book = await libraryService.openBookFile(filePath);
          upsertBook(book);
          openReader(book);
        } catch (err) {
          console.error('Failed to open dropped file by path:', err);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      isCancelled = true;
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      if (unlisten) {
        unlisten();
      }
    };
  }, [libraryService, openReader, upsertBook]);
}
