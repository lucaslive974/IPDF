import { useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import { useTheme } from '../hooks/useTheme';
import { Badge, Button, Card, IconButton, Input } from './ui';

export interface LibraryViewProps {
  readonly books: BookMetadata[];
  readonly highlights: Highlight[];
  readonly onOpenBook: (book: BookMetadata) => void;
  readonly onImportNewBook: () => void;
  readonly onOpenSettings: () => void;
}

export function LibraryView({
  books,
  highlights,
  onOpenBook,
  onImportNewBook,
  onOpenSettings,
}: LibraryViewProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'recents' | 'all' | 'highlights' | 'lists'>('recents');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas text-tx-main flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle bg-surface/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-sky-500 to-indigo-500 text-base font-black text-white shadow-sm">
            I
          </div>
          <div>
            <h1 className="text-base font-bold text-tx-main tracking-tight">IPDF Reader</h1>
            <p className="text-[0.7rem] text-tx-muted font-medium">Active Study &amp; Philosophy</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md">
          <Input
            iconLeft="🔍"
            placeholder="Search titles, authors, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" iconLeft="+" onClick={onImportNewBook}>
            Open eBook
          </Button>

          <IconButton
            variant="outline"
            size="md"
            label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </IconButton>

          <IconButton
            variant="outline"
            size="md"
            label="Settings & Directories"
            onClick={onOpenSettings}
          >
            ⚙️
          </IconButton>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1 border border-line-subtle">
            <Button
              variant={activeTab === 'recents' ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('recents')}
            >
              🕒 Recents
            </Button>
            <Button
              variant={activeTab === 'all' ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('all')}
            >
              📚 All Books ({filteredBooks.length})
            </Button>
            <Button
              variant={activeTab === 'highlights' ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('highlights')}
            >
              🖍️ Bookmarks ({highlights.length})
            </Button>
            <Button
              variant={activeTab === 'lists' ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('lists')}
            >
              📑 Reading Lists
            </Button>
          </div>

          <span className="text-xs text-tx-muted font-mono">
            {filteredBooks.length} works loaded
          </span>
        </div>

        {/* Tab 1 & 2: Books Grid */}
        {(activeTab === 'recents' || activeTab === 'all') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredBooks.map((book) => (
              <Card
                key={book.bookHash}
                variant="interactive"
                padding="md"
                className="group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="brand" size="xs">
                      {book.format}
                    </Badge>
                    <span className="text-[0.7rem] font-mono text-tx-muted">
                      {Math.round(book.percentage)}%
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-tx-main group-hover:text-brand transition line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-tx-muted font-medium">{book.author}</p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.max(4, book.percentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[0.7rem] text-tx-muted">
                    <span>
                      Page {book.currentPage} / {book.totalPages}
                    </span>
                    <Button variant="secondary" size="xs" onClick={() => onOpenBook(book)}>
                      Read &rarr;
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab 3: Highlights List */}
        {activeTab === 'highlights' && (
          <div className="flex flex-col gap-3">
            {highlights.length === 0 ? (
              <Card variant="dashed" padding="lg" className="text-center text-sm text-tx-muted">
                No highlights created yet. Open a book to start active study annotations!
              </Card>
            ) : (
              highlights.map((hl) => (
                <Card
                  key={hl.id}
                  variant="surface"
                  padding="sm"
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: hl.color }}
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm italic text-tx-main">&ldquo;{hl.text}&rdquo;</p>
                      {hl.note && (
                        <p className="text-xs text-tx-muted">
                          <span className="font-semibold text-tx-secondary">Note:</span> {hl.note}
                        </p>
                      )}
                      <span className="text-[0.65rem] text-tx-faint">
                        Page {hl.anchor.pageNumber} &bull; {hl.anchor.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-end sm:self-center shrink-0"
                    onClick={() => {
                      const book = books[0];
                      if (book) {
                        onOpenBook(book);
                      }
                    }}
                  >
                    Open in Passage &rarr;
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Reading Lists (Future Preview) */}
        {activeTab === 'lists' && (
          <div className="flex flex-col gap-4">
            <Card
              variant="dashed"
              padding="lg"
              className="text-center flex flex-col items-center gap-3"
            >
              <span className="text-3xl">📚</span>
              <h3 className="text-base font-bold text-tx-main">Custom Reading Lists</h3>
              <p className="max-w-md text-xs text-tx-muted">
                Curate custom active study tracks (e.g. &ldquo;Ancient Epistemology&rdquo;,
                &ldquo;Modern Political Philosophy&rdquo;). Coming soon in Phase 6!
              </p>
              <Button
                variant="secondary"
                size="md"
                onClick={() => alert('Reading list curation planned for Phase 6!')}
              >
                + Create Study List
              </Button>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
