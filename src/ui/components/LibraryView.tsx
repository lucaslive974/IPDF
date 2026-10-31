import { type ChangeEvent, useRef, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '../hooks/useNavigation';
import { useTheme } from '../hooks/useTheme';
import { BooksGrid } from './library/BooksGrid';
import { LibraryAnnotationsTab } from './library/LibraryAnnotationsTab';
import { LibraryCollectionsTab } from './library/LibraryCollectionsTab';
import { LibraryHeader } from './library/LibraryHeader';
import { RenameBookDialog } from './library/RenameBookDialog';
import type { SegmentedControlOption } from './ui';

export type LibraryTabId = 'recents' | 'all' | 'highlights' | 'lists';

export interface LibraryViewProps {
  readonly books?: BookMetadata[];
  readonly onOpenBook?: (book: BookMetadata) => void;
  readonly onImportNewBook?: () => void;
  readonly onOpenSettings?: () => void;
}

export function LibraryView({
  books: propBooks,
  onOpenBook: propOnOpenBook,
  onImportNewBook: propOnImportNewBook,
  onOpenSettings: propOnOpenSettings,
}: LibraryViewProps = {}) {
  const library = useLibrary();
  const navigation = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const books = propBooks ?? library.books;
  const onOpenBook = propOnOpenBook ?? navigation.openReader;
  const onOpenSettings = propOnOpenSettings ?? navigation.openSettings;

  const [activeTab, setActiveTab] = useState<LibraryTabId>('recents');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookToRename, setBookToRename] = useState<BookMetadata | null>(null);

  const handleOpenFileInput = () => {
    if (propOnImportNewBook) {
      propOnImportNewBook();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await library.importBookFile(file);
      onOpenBook(imported);
    } catch (err) {
      console.error('Failed to import book:', err);
    } finally {
      e.target.value = '';
    }
  };

  const filteredBooks = books.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) || (Boolean(b.author) && b.author.toLowerCase().includes(q))
    );
  });

  const tabOptions: readonly SegmentedControlOption<LibraryTabId>[] = [
    { id: 'recents', label: 'Recents' },
    { id: 'all', label: 'All Books', count: filteredBooks.length },
    { id: 'highlights', label: 'Annotations' },
    { id: 'lists', label: 'Collections' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col font-sans selection:bg-tx-main selection:text-canvas">
      <LibraryHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabOptions={tabOptions}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onImportClick={handleOpenFileInput}
        onFileChange={handleFileChange}
        fileInputRef={fileInputRef}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={onOpenSettings}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-6 flex flex-col gap-6">
        {(activeTab === 'recents' || activeTab === 'all') && (
          <BooksGrid
            books={filteredBooks}
            onOpenBook={onOpenBook}
            onRenameBook={setBookToRename}
            onImportClick={handleOpenFileInput}
          />
        )}

        {activeTab === 'highlights' && <LibraryAnnotationsTab />}

        {activeTab === 'lists' && <LibraryCollectionsTab />}
      </main>

      <RenameBookDialog
        isOpen={Boolean(bookToRename)}
        book={bookToRename}
        onClose={() => setBookToRename(null)}
        onRename={async (hash, newTitle) => {
          await library.renameBook(hash, newTitle);
        }}
      />
    </div>
  );
}
