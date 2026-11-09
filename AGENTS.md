# AGENTS.md — Active Study Book Reader (IPDF / Scholarium)

This repository follows a strict **Hexagonal Architecture (Ports & Adapters)** with **Test-Driven Development (TDD)**. Every agent or subagent working in this project must consult the modular documentation in `docs/` before writing any code.

## 📚 Mandatory Documentation Map

1. **[`docs/01-PRD-OVERVIEW.md`](docs/01-PRD-OVERVIEW.md)**
   Product vision, consolidated tech stack (Tauri v2, React 19, TypeScript Strict, Zustand v5, Tailwind v4, EPUB/PDF, SQLite, BYOC), and functional requirements.
2. **[`docs/02-ARCHITECTURE-UML.md`](docs/02-ARCHITECTURE-UML.md)**
   Clean Architecture principles, updated directory tree (`src/core/`, `src/adapters/`, `src/ui/`, `src/utils/`, `src/test/`, `src-tauri/src/`, and `src-tauri/crates/ipdf-core/`), path aliases, architecture diagram, and reader pagination/stream flow.
3. **[`docs/03-CORE-CONTRACTS.md`](docs/03-CORE-CONTRACTS.md)**
   Exact TypeScript contracts for value objects, entities (`BookMetadata`, `Highlight`, `RichAnnotation`, `PageWindow`), and ports (`ILibraryService`, `IReaderService`, `IHighlightService`, `IPresenceService`, `ISettingsService`, `IDocumentViewer`, `IEpubViewer`, `IPdfViewer`, `IPdfEngine`, `IDocumentViewerFactory`).
4. **[`docs/04-AGENT-WORKFLOW-AND-TDD.md`](docs/04-AGENT-WORKFLOW-AND-TDD.md)**
   Engineering rules, SQL query isolation (`*_queries.rs`), mandatory **Red -> Green -> Verify -> Commit** cycle, *Zero `any`* policy, mandatory **>= 80% test coverage** target, blocking `npm run verify` gate, and Vitest/Cargo test matrix.

## ⚡ Non-Negotiable Golden Rules

- **Backend-Heavy Rust Architecture + Reactive MVVC Frontend:**
  - **Rust (`src-tauri/crates/ipdf-core/` & `src-tauri/src/`):** Handles heavy data processing, streaming SHA-256 hashing (`Sha256BookHasher`), native pagination (`EpubBookPaginator`, `PdfBookPaginator`), cover extraction (`CoverExtractorAdapter`), SQLite persistence (`SqliteBookRepository`, `SqliteHighlightRepository`, `SqliteConfigurationStore` with SQL isolated in `*_queries.rs`), `StorageProvider` (`LocalFolderStorageAdapter`, `CachedStorageDecorator`), `DataPortabilityService`, `CloudlessSyncEngine`, `RichPresenceManager` (`DiscordPresenceAdapter`), `PromptBuilder`, `TtsSessionManager`, and modular IPC commands (`src-tauri/src/commands/`).
  - **TypeScript (`src/`):** Focused on 60fps DOM/Canvas rendering (`EpubViewerAdapter`, `PdfViewerAdapter`, `DefaultPdfEngine`), LRU caching (`CachedReaderServiceDecorator`), modular IPC bridges (`TauriLibraryService`, `TauriReaderService`, `TauriHighlightService`, `TauriPresenceService`, `TauriSettingsService`), pure utilities (`src/utils/`), and the **MVVC with Zustand** presentation layer (`src/ui/providers`, `src/ui/stores`, `src/ui/hooks`, `src/ui/components`).
- **100% English Code and Documentation:** All source code (`src/` and `src-tauri/`), symbol names, error messages, comments/JSDoc, and technical documentation must be written **exclusively in English**.
- **Desktop + Mobile Portability (`WKWebView` / Android):** Never use Node.js `Buffer` in `src/core/`. Always use `Uint8Array` or `ArrayBuffer`.
- **Dependency Injection & DOM Isolation:** No class in `src/core/` or `ipdf-core` may access global singletons, `window` directly, physical databases, or network APIs. On the frontend, DOM interactions must go through the safe helpers in `src/utils/dom.ts` and `src/utils/domSelection.ts` or the viewer adapters in `src/adapters/viewers/`.
- **Strict Modularization Parity (TypeScript & Rust):** Concentrating multiple entities, ports, services, commands, or SQL queries into monolithic "super files" is strictly forbidden:
  - In `src-tauri/crates/ipdf-core/src/`: maintain modular separation across `core/domain/`, `core/ports/`, `core/services/`, and `adapters/` (`configuration/`, `extractor/`, `pagination/`, `persistence/`, `platform/`, `presence/`, `storage/`).
  - In `src-tauri/src/`: keep Tauri commands split by domain in `commands/` (`library.rs`, `reader.rs`, `highlights.rs`, `settings.rs`, `ai.rs`, `system.rs`).
- **Modular MVVC Frontend with Zustand (`src/ui/`):** Never mix IoC, state management, business rules, and extensive JSX in the same file. Separate strictly into:
  1. `src/ui/providers/` (DI, Navigation, and Theme contexts),
  2. `src/ui/stores/` (Zustand stores consumed via atomic selectors),
  3. `src/ui/hooks/` (ViewModels / Custom Hooks and controllers encapsulating use cases),
  4. `src/ui/components/ui/` (Atomic Design System components exported via `@ui`),
  5. `src/ui/components/` (Domain visual components grouped under `library/`, `reader/`, `settings/`).
- **Mandatory Design System (No Repetitive Raw HTML):** The entire UI must be composed of Design System components (`@ui`) and semantic Tailwind tokens (`styles.css`), validated by `scripts/lint-tailwind.mjs`.
- **Zero `any` Policy:** Using `any` is strictly prohibited.
- **Minimum Test Coverage (>= 80% in TypeScript & Rust):** All code must maintain at least **80% coverage** (validated by `@vitest/coverage-v8` in TS and `llvm-cov` via `scripts/rust-coverage.mjs` in Rust).
- **Blocking Quality Gate:** No commit may be made unless `npm run verify` (`format` + `lint` + `typecheck` + `test`, running both `:frontend` and `:backend`) returns `exit code 0`.
