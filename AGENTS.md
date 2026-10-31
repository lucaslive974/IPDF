# AGENTS.md — Active Study Book Reader (IPDF)

Este repositório segue uma arquitetura **Hexagonal (Ports & Adapters)** estrita com desenvolvimento guiado por testes (**TDD**). Todo agente ou subagente atuando neste projeto deve consultar a documentação modular em `docs/` antes de escrever qualquer linha de código.

## 📚 Mapa de Documentação Obrigatória

1. **[`docs/01-PRD-OVERVIEW.md`](docs/01-PRD-OVERVIEW.md)**
   Visão do produto, stack tecnológica (Tauri v2, TypeScript Strict, EPUB/PDF, SQLite, BYOC), requisitos funcionais e o Roadmap dividido em 6 fases.
2. **[`docs/02-ARCHITECTURE-UML.md`](docs/02-ARCHITECTURE-UML.md)**
   Princípios de Clean Architecture, árvore de diretórios obrigatória (`src/core/domain`, `src/core/ports`, `src/core/services`, `src/adapters`, `src/ui` e `src/test/` para os testes de frontend/TS), diagrama de classes UML e estrutura de sincronização remota (*Cloudless Sync*).
3. **[`docs/03-CORE-CONTRACTS.md`](docs/03-CORE-CONTRACTS.md)**
   Contratos TypeScript exatos e imutáveis para objetos de valor, entidades (`Highlight`, `RichAnnotation` com Discriminated Unions e Handler Maps, `BookMetadata`) e portas (`IAnnotationToolStrategy`, `IAssistedTextFormattingStrategy`, `IDocumentViewer`, `IBackendGateway`).
4. **[`docs/04-AGENT-WORKFLOW-AND-TDD.md`](docs/04-AGENT-WORKFLOW-AND-TDD.md)**
   Regras de engenharia, ciclo obrigatório **Red -> Green -> Verify -> Commit**, política *Zero `any`*, meta mínima obrigatória de **80% de cobertura de testes (Test Coverage)**, comando bloqueante `npm run verify` e matriz de testes unitários obrigatórios no Vitest.

## ⚡ Regras de Ouro Inegociáveis

- **Arquitetura Backend-Heavy em Rust (`Caminho 2`):**
  - **Rust (`src-tauri/crates/ipdf-core/` & `src-tauri/`):** Concentra o motor pesado de dados, hashing SHA-256 em *streaming* (`Sha256BookHasher`), persistência SQLite, `StorageProvider` (arquivos avulsos, pastas locais, nuvem e `CachedStorageDecorator`), `DataPortabilityService` (LWW, ZIP), `CloudlessSyncEngine`, `RichPresenceManager` (Discord IPC / Webhooks), `PromptBuilder`, `TtsProvider` + `TtsSessionManager` (síntese de voz neural/nativa com *prefetch*) e `SystemBridge` (`MediaControlService`, `PowerSaveBlocker`, `NotificationService`, `ClipboardService`).
  - **TypeScript (`src/`):** Focado exclusivamente em renderização DOM/Canvas (`IDocumentViewer`: `epub.js`, `pdf.js`), edição visual/assistida a 60fps (`IAnnotationToolStrategy`: `AssistedRichTextStrategy`, `tldraw`, `draw.io`), ponte IPC (`IBackendGateway`) e camada de apresentação **MVVC** (`src/ui/providers`, `src/ui/hooks`, `src/ui/components`).
- **Código e Comentários 100% em Inglês:** Todo código-fonte (`src/` e `src-tauri/`), nomes de símbolos, mensagens de erro e comentários/JSDoc (quando estritamente necessários) devem ser escritos **exclusivamente em inglês**. Evite comentários óbvios nas estruturas de dados.
- **Portabilidade Desktop + iOS (`WKWebView`):** Nunca utilize `Buffer` do Node.js em `src/core/`. Utilize sempre `Uint8Array` ou `ArrayBuffer`.
- **Injeção de Dependência Pura:** Nenhuma classe em `src/core/` ou `ipdf-core` pode acessar singletons globais, `window` diretamente, banco de dados físico ou rede. Tudo entra via `constructor` / traits tipados pelas portas.
- **Paridade de Modularização Estrita (TypeScript & Rust):** É terminantemente proibido concentrar múltiplas entidades, portas, serviços ou testes em "super arquivos" monolíticos (como um único `domain.rs`, `ports.rs` ou `services.rs`). O backend Rust (`src-tauri/crates/ipdf-core/src/`) **DEVE** espelhar a mesma organização modular de um arquivo por responsabilidade usada no TypeScript:
  - `core/domain/` (`types.rs`, `book_metadata.rs`, `rich_annotation.rs`, `highlight.rs`),
  - `core/ports/` (`repository.rs`, `storage_provider.rs`, `platform_environment.rs`, `configuration_store.rs`, `export_strategy.rs`, `llm_provider.rs`, `presence_provider.rs`, `tts_provider.rs`, `system_bridge.rs`),
  - `core/services/` (`sha256_book_hasher.rs`, `library_manager.rs`, `highlight_manager.rs`, `data_portability_service.rs`, `cloudless_sync_engine.rs`, `prompt_builder.rs`, `rich_presence_manager.rs`, `tts_session_manager.rs`),
  - `adapters/` (`persistence/sqlite_book_repository.rs`, `persistence/sqlite_highlight_repository.rs`, `platform/` (`linux_environment.rs`, `android_environment.rs`, `windows_environment.rs`, `ios_environment.rs`, `web_environment.rs`), `configuration/` (`file_configuration_store.rs`, `local_storage_configuration_store.rs`, `sqlite_configuration_store.rs`), `storage/local_folder_storage_adapter.rs`, `storage/cached_storage_decorator.rs`),
  - `tests/` (`fakes/mod.rs` e arquivos `*_spec.rs` dedicados por domínio/serviço).
- **Frontend MVVC / MVVM Modular (`src/ui/`):** Proibido misturar IoC, gerenciamento de estado/regras e JSX em "super arquivos". Separe estritamente em:
  1. `src/ui/providers/` (Inversão de Controle / Contextos de DI e Tema),
  2. `src/ui/hooks/` (ViewModels / Custom Hooks concentrando estado e casos de uso),
  3. `src/ui/components/ui/` (Componentes atômicos do Design System: `Button`, `IconButton`, `Card`, `Badge`, `Input`, `Modal`, `Popover`),
  4. `src/ui/components/` (Componentes visuais de alto nível e telas recebendo dados via props).
- **Design System Obrigatório (Sem HTML Puro Repetitivo):** Toda a interface deve ser composta por componentes pré-estilizados do Design System (`src/ui/components/ui/`) e tokens semânticos do Tailwind (`styles.css`). É proibido escrever tags HTML cruas com classes repetidas de estilização inline (`<button className="...">`, `<div className="rounded-xl border...">`, `<input className="...">`) nos componentes de visão. A consistência visual e o suporte a temas (Light/Dark) dependem exclusivamente dessa camada de componentes reutilizáveis.
- **Zero `any` Policy:** Proibido usar `any`.
- **Cobertura de Testes Mínima (>= 80% em TypeScript & Rust + Coverage Gutters):** Todo código em `src/core/`, `src/adapters/` e `src-tauri/crates/ipdf-core/src/` deve manter no mínimo **80% de cobertura** (validado por `@vitest/coverage-v8` no TS e `llvm-cov` via `scripts/rust-coverage.mjs` no Rust), gerando LCOV unificado em `coverage/lcov.info` compatível com a extensão **Coverage Gutters**.
- **Quality Gate Bloqueante:** Nenhum commit pode ser realizado sem que `npm run verify` (`format` + `lint` + `typecheck` + `test`, onde cada script executa tanto `:frontend` quanto `:backend`) retorne `exit code 0`.
