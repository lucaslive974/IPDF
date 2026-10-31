import { useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';

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
  const [activeTab, setActiveTab] = useState<'recents' | 'all' | 'highlights' | 'lists'>('recents');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-sky-500 to-indigo-500 text-base font-black text-white shadow-lg">
            I
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">IPDF Reader</h1>
            <p className="text-[0.7rem] text-slate-400 font-medium">
              Active Study &amp; Philosophy
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex flex-1 max-w-md items-center rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 focus-within:border-sky-500 transition">
          <span className="text-slate-400 text-xs mr-2">🔍</span>
          <input
            type="text"
            className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            placeholder="Search titles, authors, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-950 transition hover:bg-sky-500 active:scale-95"
            onClick={onImportNewBook}
          >
            <span>+</span>
            <span>Open eBook</span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition active:scale-95"
            onClick={onOpenSettings}
            title="Settings &amp; Directories"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-800">
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'recents'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setActiveTab('recents')}
            >
              🕒 Recents
            </button>
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setActiveTab('all')}
            >
              📚 All Books ({filteredBooks.length})
            </button>
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'highlights'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setActiveTab('highlights')}
            >
              🖍️ Bookmarks ({highlights.length})
            </button>
            <button
              type="button"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'lists'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setActiveTab('lists')}
            >
              📑 Reading Lists
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {filteredBooks.length} works loaded
          </span>
        </div>

        {/* Tab 1 & 2: Books Grid */}
        {(activeTab === 'recents' || activeTab === 'all') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredBooks.map((book) => (
              <div
                key={book.bookHash}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition hover:border-slate-700 hover:bg-slate-900 hover:shadow-xl active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-sky-400">
                      {book.format}
                    </span>
                    <span className="text-[0.7rem] font-mono text-slate-400">
                      {Math.round(book.percentage)}%
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 font-medium">{book.author}</p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-linear-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${Math.max(4, book.percentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[0.7rem] text-slate-400">
                    <span>
                      Page {book.currentPage} / {book.totalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-800 px-3 py-1 font-semibold text-slate-200 hover:bg-sky-600 hover:text-white transition"
                      onClick={() => onOpenBook(book)}
                    >
                      Read &rarr;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Highlights List */}
        {activeTab === 'highlights' && (
          <div className="flex flex-col gap-3">
            {highlights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-sm text-slate-500">
                No highlights created yet. Open a book to start active study annotations!
              </div>
            ) : (
              highlights.map((hl) => (
                <div
                  key={hl.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 transition hover:border-slate-700"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: hl.color }}
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm italic text-slate-200">&ldquo;{hl.text}&rdquo;</p>
                      {hl.note && (
                        <p className="text-xs text-slate-400">
                          <span className="font-semibold text-slate-300">Note:</span> {hl.note}
                        </p>
                      )}
                      <span className="text-[0.65rem] text-slate-500">
                        Page {hl.anchor.pageNumber} &bull; {hl.anchor.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="self-end sm:self-center shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                    onClick={() => {
                      const book = books[0];
                      if (book) {
                        onOpenBook(book);
                      }
                    }}
                  >
                    Open in Passage &rarr;
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Reading Lists (Future Preview) */}
        {activeTab === 'lists' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">📚</span>
              <h3 className="text-base font-bold text-slate-200">Custom Reading Lists</h3>
              <p className="max-w-md text-xs text-slate-400">
                Curate custom active study tracks (e.g. &ldquo;Ancient Epistemology&rdquo;,
                &ldquo;Modern Political Philosophy&rdquo;). Coming soon in Phase 6!
              </p>
              <button
                type="button"
                className="mt-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                onClick={() => alert('Reading list curation planned for Phase 6!')}
              >
                + Create Study List
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
