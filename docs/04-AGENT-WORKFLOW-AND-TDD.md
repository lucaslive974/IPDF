# 04. Agent Engineering Guidelines: TDD, Quality Gates & Git Workflow

This document defines the mandatory operational rules for any AI coding agent working in this repository.

---

## 1. Design Philosophy & Testability

1. **"Hard to test = Bad coupling":**
   If testing a function or method requires spinning up a Tauri window, instantiating the real PDF.js engine without a mock, connecting to a physical SQLite file without an abstraction, or making live network calls, **STOP IMMEDIATELY**. Extract the external dependency into a port in `src/core/ports/` (or trait in `src-tauri/crates/scholarium-core/src/core/ports/`) and inject it via constructor, factory arguments, or Context Provider.
2. **No Direct DOM Access Outside Utilities/Viewers:**
   On the frontend, safe access to `window`, `document`, `requestAnimationFrame`, and selectors must go through the utilities in `src/utils/dom.ts` and `src/utils/domSelection.ts` or the viewer adapters in `src/adapters/viewers/`.
3. **Zero `any` Policy:**
   Using `any` is strictly prohibited. Use strict types, Generics, or `unknown` with type guards.
4. **English-Only Source Code & Documentation Policy:**
   All source code in `src/`, `src-tauri/`, and `docs/` (including type names, variables, functions, technical strings, and comments/JSDoc) must be written **100% in English**.
5. **Modularization Parity (TypeScript & Rust) & SQL Query Isolation:**
   - **No "Super Files":** In both TypeScript and Rust, every entity, port, service, adapter, and test suite must live in its own dedicated file.
   - **Isolated SQL Queries:** In Rust SQLite adapters (`sqlite_book_repository.rs`, `sqlite_highlight_repository.rs`, `sqlite_configuration_store.rs`), all SQL constants and statements must be isolated in their respective `*_queries.rs` modules (`sqlite_book_queries.rs`, `sqlite_highlight_queries.rs`, `sqlite_configuration_queries.rs`).
   - **MVVC + Zustand Frontend (`src/ui/`):** Separate strictly into:
     - **IoC Providers (`src/ui/providers/`):** Service container, theme, and navigation injection.
     - **Zustand Stores (`src/ui/stores/`):** Reactive modular state always consumed via atomic selectors (`useReaderStore((s) => s.currentPage)`).
     - **ViewModel Hooks (`src/ui/hooks/`):** Custom Hooks and controller factories isolating orchestration rules and side effects.
     - **Design System (`src/ui/components/ui/`) & Visual Components (`src/ui/components/`):** Declarative components built from Design System atoms (`@ui`), avoiding raw HTML tags with repetitive utility classes.
6. **Minimum Test Coverage Target (>= 80% in TypeScript and Rust):**
   Maintaining **at least 80% test coverage** is mandatory across both TypeScript (validated by `@vitest/coverage-v8`) and Rust (`src-tauri/crates/scholarium-core/src/`, validated by `llvm-cov` via `scripts/rust-coverage.mjs` requiring `lines >= 80%`, `functions >= 80%`, and `regions >= 80%`).

---

## 2. The Mandatory Cycle: Red -> Green -> Verify -> Commit

For every feature or fix implemented, strictly follow these 4 steps:

### Step 1: Test First (Red)
- **Strict Separation in `src/test/`:** All TypeScript/UI tests (`*.spec.ts`) must reside under `src/test/`, mirroring the folder structure of `src/`.
- Use or extend `MockBackend` in `src/test/mocks/MockBackend.ts` for frontend tests and the test doubles in `src-tauri/crates/scholarium-core/tests/fakes/mod.rs` for Rust tests.
- **Note on Zustand in SSR Tests (`renderToStaticMarkup`):** Because React SSR's `useSyncExternalStore` uses `getServerSnapshot` (which returns the initial store state), pass data via `props` when testing purely visual components with `renderToStaticMarkup`, or test store/hook logic directly.

### Step 2: Clean Implementation (Green)
- Implement production code adhering to the contracts in `docs/03-CORE-CONTRACTS.md` and the configured path aliases (`@domain`, `@ports`, `@adapters`, `@hooks`, `@stores`, `@ui`, `@utils`).

### Step 3: Blocking Quality Gate (Verify)
Before considering any task complete, run:

```bash
npm run verify
```

`npm run verify` executes in sequence:
1. `npm run format` (`biome format --write ./src` + `cargo fmt`)
2. `npm run lint` (`biome check ./src && node scripts/lint-tailwind.mjs` + `cargo fmt --check && cargo clippy --all-targets -- -D warnings`)
3. `npm run typecheck` (`tsc --noEmit` + `cargo check --all-targets`)
4. `npm run test` (`vitest run --coverage` + `node scripts/rust-coverage.mjs`, both enforcing >= 80% coverage)

> [!CAUTION]
> **BLOCKING RULE:** If any step of `npm run verify` fails or drops below **80% coverage**, committing or finishing the task is strictly prohibited.

### Step 4: Atomic Commit (Conventional Commits)
Once `npm run verify` returns `exit code 0`, create small, semantic commits (`feat(...)`, `fix(...)`, `refactor(...)`, `test(...)`, `docs(...)`).

---

## 3. Mandatory Test Suite Matrix

| Layer | Scope | Test Suites | Verified Responsibilities |
| :--- | :--- | :--- | :--- |
| **TS Core & Utils** | Domain, Page Windows & LRU Cache | `src/test/core/domain/Highlight.spec.ts`<br>`src/test/core/domain/PageWindow.spec.ts`<br>`src/test/core/utils/lruCache.spec.ts` | CFI (EPUB) and AABB (PDF) collision detection, formatting via `AnnotationFormatterMap`, `PageWindow` bounds calculation, and LRU eviction. |
| **TS Adapters** | Tauri IPC, Cache Decorator & Viewers (EPUB/PDF) | `src/test/adapters/ipc/TauriBackend.spec.ts`<br>`src/test/adapters/ipc/CachedReaderServiceDecorator.spec.ts`<br>`src/test/adapters/viewers/EpubViewerAdapter.spec.ts`<br>`src/test/adapters/viewers/PdfViewerAdapter.spec.ts`<br>`src/test/adapters/viewers/DefaultPdfEngine.spec.ts` | IPC serialization/deserialization, batch file import (`openBookFiles`), LRU caching of pages/binaries, EPUB chapter rendering, and PDF canvas/text-layer rendering with cooperative cancellation. |
| **TS UI Stores & Hooks** | Zustand Stores, Pagination, Bootstrap, Highlights & Library | `src/test/ui/stores/*.spec.ts`<br>`src/test/ui/hooks/useReaderBootstrapper.spec.ts`<br>`src/test/ui/hooks/useReaderPagination.spec.ts`<br>`src/test/ui/hooks/useReaderHighlights.spec.ts`<br>`src/test/ui/hooks/usePdfPageRenderer.spec.ts`<br>`src/test/ui/hooks/useLibrary*.spec.ts`<br>`src/test/ui/hooks/useSystemHandler.spec.ts` | Decoupled bootstrap, $O(1)$ pagination (`LoadedPagesInfo`), focal detection filtering `rect.height > 0`, idempotent Rich Presence sync (`actual === last`), zoom gestures, text selection, and notes. |
| **TS UI Components & Utils** | Visual Components & Pure Utilities | `src/test/ui/components/*.spec.ts`<br>`src/test/utils/*.spec.ts` | Viewport chapter indicator, suppression of repetitive EPUB chapter headers, PDF highlight overlay, paragraph tokenization, Markdown formatting, and PDF cover generation. |
| **Rust (`scholarium-core`)** | Domain, Hashing & SQLite Repositories | `tests/highlight_spec.rs`<br>`tests/sha256_book_hasher_spec.rs`<br>`tests/sqlite_book_repository_spec.rs`<br>`tests/library_and_sqlite_spec.rs` | Streaming SHA-256 hashing (64 KB), SQLite persistence for books and highlights, and batch file opening (`open_books_from_paths`). |
| **Rust (`scholarium-core`)** | Paginators, Cover Extractors & Reader | `tests/reader_and_paginator_spec.rs`<br>`tests/cover_extractor_spec.rs` | Native EPUB and PDF pagination (`EpubBookPaginator`, `PdfBookPaginator`), `ReaderManager`, and cover extraction (`CoverExtractorAdapter`). |
| **Rust (`scholarium-core`)** | Platform, Sync, Discord IPC & TTS | `tests/platform_and_config_spec.rs`<br>`tests/cloudless_sync_and_portability_spec.rs`<br>`tests/cached_storage_and_presence_spec.rs`<br>`tests/discord_presence_spec.rs`<br>`tests/tts_and_system_bridge_spec.rs` | OS directory resolution, LWW merge, `CachedStorageDecorator`, `RichPresenceManager`, `DiscordPresenceAdapter`, and `TtsSessionManager`. |
