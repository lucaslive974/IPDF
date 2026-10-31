import { type ChangeEvent, useRef, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '../hooks/useNavigation';
import { useTheme } from '../hooks/useTheme';
import {
  Badge,
  BookIcon,
  Button,
  Card,
  IconButton,
  Input,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from './ui';

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

  const [activeTab, setActiveTab] = useState<'recents' | 'all' | 'highlights' | 'lists'>('recents');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col font-sans selection:bg-tx-main selection:text-canvas">
      {/* Top Apple-Style Monochromatic Navigation */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle bg-canvas/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-subtle bg-surface text-xs font-semibold tracking-wider text-tx-main shadow-2xs">
            IP
          </div>
          <div>
            <h1 className="text-sm font-semibold text-tx-main tracking-tight">Library</h1>
            <p className="text-[0.65rem] text-tx-muted font-normal">Active Study</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-sm">
          <Input
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
            placeholder="Search titles, authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-tx-main"
            iconLeft={<PlusIcon className="h-3.5 w-3.5" />}
            onClick={handleOpenFileInput}
          >
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload eBook file"
          />

          <IconButton
            variant="ghost"
            size="sm"
            label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </IconButton>

          <IconButton
            variant="ghost"
            size="sm"
            label="Settings & Directories"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        {/* Navigation Tabs (Apple Segmented Control) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-3">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-subtle/80 p-0.5 border border-line-subtle/60 text-xs font-medium">
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'recents'
                  ? 'bg-surface text-tx-main shadow-2xs'
                  : 'text-tx-muted hover:text-tx-main'
              }`}
              onClick={() => setActiveTab('recents')}
            >
              Recents
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'all'
                  ? 'bg-surface text-tx-main shadow-2xs'
                  : 'text-tx-muted hover:text-tx-main'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All Books ({filteredBooks.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'highlights'
                  ? 'bg-surface text-tx-main shadow-2xs'
                  : 'text-tx-muted hover:text-tx-main'
              }`}
              onClick={() => setActiveTab('highlights')}
            >
              Annotations
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'lists'
                  ? 'bg-surface text-tx-main shadow-2xs'
                  : 'text-tx-muted hover:text-tx-main'
              }`}
              onClick={() => setActiveTab('lists')}
            >
              Collections
            </button>
          </div>

          <span className="text-xs text-tx-muted font-mono font-medium">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'work' : 'works'}
          </span>
        </div>

        {/* Tab 1 & 2: Books Grid */}
        {(activeTab === 'recents' || activeTab === 'all') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredBooks.length === 0 ? (
              <Card
                variant="dashed"
                padding="lg"
                className="col-span-full text-center text-xs text-tx-muted py-14"
              >
                <div className="flex flex-col items-center gap-2">
                  <BookIcon className="h-6 w-6 text-tx-faint" />
                  <p>No books found. Click &ldquo;Import&rdquo; above to load an EPUB or PDF.</p>
                </div>
              </Card>
            ) : (
              filteredBooks.map((book) => (
                <Card
                  key={book.bookHash}
                  variant="interactive"
                  padding="md"
                  className="group flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex flex-col gap-3">
                    {/* Front Book Cover */}
                    {book.coverImageUrl ? (
                      <div className="relative aspect-3/4 w-full overflow-hidden rounded-md bg-surface-subtle shadow-xs border border-line-subtle/60 flex items-center justify-center">
                        <img
                          src={book.coverImageUrl}
                          alt={`Cover of ${book.title}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-3/4 w-full rounded-md bg-surface-subtle border border-line-subtle/50 p-4 flex flex-col justify-between shadow-2xs">
                        <span className="text-[0.62rem] font-medium uppercase tracking-widest text-tx-muted">
                          Edition
                        </span>
                        <div>
                          <p className="font-serif font-bold text-sm text-tx-main line-clamp-2">
                            {book.title}
                          </p>
                          <p className="text-xs text-tx-muted mt-1">{book.author}</p>
                        </div>
                        <BookIcon className="h-4 w-4 text-tx-faint" />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant="neutral" size="xs">
                        {book.format}
                      </Badge>
                      <span className="text-[0.68rem] font-mono text-tx-muted">
                        {Math.round(book.percentage)}%
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-tx-main group-hover:text-tx-secondary transition line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="mt-0.5 text-[0.72rem] text-tx-muted font-normal">
                        {book.author}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2.5">
                    {/* Monochromatic Apple Progress Bar */}
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full bg-tx-main/80 transition-all duration-300"
                        style={{ width: `${Math.max(4, book.percentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
                      <span>
                        Page {book.currentPage} of {book.totalPages}
                      </span>
                      <Button variant="ghost" size="xs" onClick={() => onOpenBook(book)}>
                        Read &rarr;
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Bookmarks / Highlights List */}
        {activeTab === 'highlights' && (
          <div className="flex flex-col gap-3">
            <Card variant="dashed" padding="lg" className="text-center text-xs text-tx-muted py-8">
              Bookmarks and passage annotations are indexed within active study reading sessions.
            </Card>
          </div>
        )}

        {/* Tab 4: Reading Lists */}
        {activeTab === 'lists' && (
          <div className="flex flex-col gap-4">
            <Card
              variant="dashed"
              padding="lg"
              className="text-center flex flex-col items-center gap-3 py-10"
            >
              <BookIcon className="h-6 w-6 text-tx-faint" />
              <h3 className="text-sm font-semibold text-tx-main">Curated Collections</h3>
              <p className="max-w-md text-xs text-tx-muted">
                Curate custom active study tracks (e.g. &ldquo;Ancient Epistemology&rdquo;,
                &ldquo;Modern Political Philosophy&rdquo;).
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => alert('Reading list curation planned for Phase 6!')}
              >
                New Collection
              </Button>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
