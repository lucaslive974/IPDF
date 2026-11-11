# 01. Product Requirements Document (PRD): Scholarium Active Study Book Reader

## 1. Product Vision

A cross-platform digital book reader (**EPUB** and **PDF**) targeting **Desktop (Linux, Windows, macOS)** and **Mobile (Android, iOS)**, designed specifically for dense reading, philosophy, and active study.

The system operates under **Offline-First** and **BYOC (Bring Your Own Cloud)** principles, integrating:
- **Continuous Page Streaming (`ReaderStream`):** Fluid reading with sliding-window pagination ($O(1)$ lookup via `LoadedPagesInfo`), accurate sub-page scroll restoration (`pageOffsetRatio`), smart chapter headers, and a subtle viewport chapter indicator;
- **Polymorphic Highlighter & Assisted Markdown Notes:** Persistent multi-color highlights anchored via `epubCfi` (for EPUB) or normalized `BoundingBox` rectangles (for PDF), featuring an assisted Markdown formatting toolbar and margin notes;
- **Library & Collections:** Visual catalog with batch file import (`openBookFiles`), hybrid cover extraction (native in Rust for EPUB and PDF.js Canvas fallback for PDFs), metadata editing, tags, and collections;
- **Contextual LLM Translation & Dictionary:** Structured prompt construction (`PromptBuilder`) injecting book title, author, chapter, selected text, and surrounding paragraph context;
- **Text-to-Speech (TTS) & System Bridge:** Read-aloud session orchestration (`TtsSessionManager`) with sentence prefetching, screen wake lock (`PowerSaveBlocker`), and OS media controls;
- **Native Discord Rich Presence:** Real-time reading status broadcasting (book title, author, chapter, current/total pages, and elapsed time) over local IPC with debouncing and resilient reconnection;
- **Data Portability & Cloudless Sync:** Serverless synchronization and backup using *Last-Write-Wins (LWW)* conflict resolution based on `updatedAt` timestamps.

---

## 2. Core Technology Stack

| Layer | Technology / Library | Technical Decisions & Details |
| :--- | :--- | :--- |
| **Cross-Platform Runtime** | **Tauri v2 (Backend-Heavy in Rust)** | Heavy data processing, storage, streaming SHA-256 hashing (64 KB chunks), EPUB/PDF pagination, cover extraction, SQLite, LWW Sync, and Discord IPC in **Rust (`src-tauri/crates/scholarium-core`)** + modular IPC shell in **`src-tauri/src/`**. |
| **Modularization Parity (TS & Rust)** | **Symmetric Hexagonal Architecture** | Monolithic "super files" are prohibited in both TypeScript and Rust. Every entity, port, service, adapter, and SQL query resides in its own dedicated file. |
| **Frontend & State** | **React 19 + TypeScript Strict + Zustand v5 + React Hook Form** | **MVVC** architecture (`providers/`, `stores/`, `hooks/`, `components/`). Decoupled reactive state in selective Zustand stores (`useReaderStore`, `useLibraryStore`, `useHighlightStore`, `useReaderUIStore`, `useTypographyStore`) ensuring zero unnecessary re-renders at 60fps. |
| **Styling & Design System** | **Tailwind CSS v4 + Atomic Components (`@ui`)** | Semantic design tokens (`bg-canvas`, `bg-surface`, `text-tx-main`, etc.) with multi-theme support (Light/Dark/Sepia) and static enforcement (`scripts/lint-tailwind.mjs`). |
| **EPUB Renderer** | **`EpubViewerAdapter` + Rust Paginator (`EpubBookPaginator`)** | Dynamic typographic reflow with inline highlight tokenization and *Canonical Fragment Identifier* (**CFI**) anchoring. |
| **PDF Renderer** | **`pdfjs-dist` (`PdfViewerAdapter` + `DefaultPdfEngine`)** | On-demand `<canvas>` rasterization + transparent `TextLayer` for pixel-accurate selection + `PdfHighlightLayer` with normalized Cartesian coordinates (`[0..1]`) and cooperative cancellation. |
| **In-Memory Cache (Frontend)** | **LRU Cache (`CachedReaderServiceDecorator`)** | Decorator over `IReaderService` caching book binaries and page windows in an LRU cache with automatic invalidation. |
| **Local Persistence** | **SQLite (`rusqlite` bundled) + Local FS** | Native Rust SQLite repositories (`SqliteBookRepository`, `SqliteHighlightRepository`, `SqliteConfigurationStore`) with SQL statements isolated in `*_queries.rs` modules. |
| **Book Identity** | **SHA-256 (`bookHash`)** | Computed over the raw file binary via `Sha256BookHasher`, guaranteeing immutable cross-device identity regardless of filename. |
| **Quality & Testing** | **Vitest (v8 Coverage) + Cargo llvm-cov + Biome + TSC** | Blocking quality gate via `npm run verify` enforcing **>= 80% coverage** across both Frontend and Rust Backend. |

---

## 3. Consolidated Functional Requirements

1. **Unified Library & Batch Import:**
   - Supports opening and importing multiple `.epub` and `.pdf` files simultaneously (`openBookFiles` / `open_book_files`) with automatic `bookHash` deduplication.
   - Automatic metadata and cover extraction (cached on disk at `<cache_dir>/covers/<bookHash>.<ext>`, with client-side PDF.js page-1 rendering fallback when a PDF lacks an embedded cover).
   - Organization by authors, tags, full-text search, and centralized library-wide annotation and collection views (`LibraryAnnotationsTab` and `LibraryCollectionsTab`).
2. **Continuous 60fps Reading (`ReaderView` & `ReaderStream`):**
   - On-demand windowed pagination (`PageWindow`) with bidirectional automatic prefetching (`useReaderPagination`).
   - 60fps focal page detection via `requestAnimationFrame`, filtering out collapsed/unrendered elements (`rect.height > 0`) and preserving exact sub-page scroll position (`pageOffsetRatio`).
   - In EPUB mode, repetitive chapter headers across consecutive pages of the same chapter are suppressed, while a subtle floating chapter indicator is shown in the top-right corner of the viewport when immersive mode is active (`!isChromeVisible`).
   - Typography controls (font family, font size, line spacing) and zoom gestures (`Ctrl+Wheel`, keyboard shortcuts, and zoom bar).
3. **Polymorphic Highlights & Assisted Notes:**
   - Custom selection context menu (`ReaderContextMenu`) supporting multi-color highlights, copy, translation, and AI explanation.
   - Assisted Markdown notes (`assisted-markdown`) with a visual formatting toolbar (`AssistedFormattingToolbar`) applying bold, italic, underline, strikethrough, headings, lists, and blockquotes via pure functions (`src/utils/markdownFormatting.ts`).
   - Paragraph margin note indicators (`ParagraphMarginNotes`) and quick-edit popovers/modals (`HighlightPopover` / `HighlightDetailModal`).
4. **Focal-Driven Discord Rich Presence:**
   - Reading presence synchronization tied directly to the focal scroll calculation (`useReaderPagination`) and direct page jumps (`goToPage`), guarded by a last-reported page ref (`actual === last` skips redundant calls) and backend debouncing in `RichPresenceManager`.
5. **Data Portability & Synchronization (`DataPortabilityService` & `CloudlessSyncEngine`):**
   - Export and import of reading state and highlights with *Last-Write-Wins (LWW)* conflict resolution based on `updatedAt`.
   - Storage abstraction via `StorageProvider` (`LocalFolderStorageAdapter` and `CachedStorageDecorator`).
