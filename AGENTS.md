# AGENTS.md — Active Study Book Reader (IPDF)

Este repositório segue uma arquitetura **Hexagonal (Ports & Adapters)** estrita com desenvolvimento guiado por testes (**TDD**). Todo agente ou subagente atuando neste projeto deve consultar a documentação modular em `docs/` antes de escrever qualquer linha de código.

## 📚 Mapa de Documentação Obrigatória

1. **[`docs/01-PRD-OVERVIEW.md`](docs/01-PRD-OVERVIEW.md)**
   Visão do produto, stack tecnológica (Tauri v2, TypeScript Strict, EPUB/PDF, SQLite, BYOC), requisitos funcionais e o Roadmap dividido em 6 fases.
2. **[`docs/02-ARCHITECTURE-UML.md`](docs/02-ARCHITECTURE-UML.md)**
   Princípios de Clean Architecture, árvore de diretórios obrigatória (`src/core/domain`, `src/core/ports`, `src/core/services`, `src/adapters`, `src/ui` e `src/test/` para os testes de frontend/TS), diagrama de classes UML e estrutura de sincronização remota (*Cloudless Sync*).
3. **[`docs/03-CORE-CONTRACTS.md`](docs/03-CORE-CONTRACTS.md)**
   Contratos TypeScript exatos e imutáveis para objetos de valor, entidades (`Highlight`, `RichAnnotation` com Visitor/Double Dispatch, `BookMetadata`) e portas (`IAnnotationToolStrategy`, `IAssistedTextFormattingStrategy`, `IRepository`, `IDocumentViewer`, `ILLMProvider`, `ITTSProvider`, `IPresenceProvider`, `ISystemBridge`, `IStorageProvider`).
4. **[`docs/04-AGENT-WORKFLOW-AND-TDD.md`](docs/04-AGENT-WORKFLOW-AND-TDD.md)**
   Regras de engenharia, ciclo obrigatório **Red -> Green -> Verify -> Commit**, política *Zero `any`*, meta mínima obrigatória de **80% de cobertura de testes (Test Coverage)**, comando bloqueante `npm run verify` e matriz de testes unitários obrigatórios no Vitest.

## ⚡ Regras de Ouro Inegociáveis

- **Arquitetura Backend-Heavy em Rust (`Caminho 2`):**
  - **Rust (`src-tauri/crates/ipdf-core/` & `src-tauri/`):** Concentra o motor pesado de dados, hashing SHA-256 em *streaming* (`Sha256BookHasher`), persistência SQLite, `IStorageProvider` (arquivos avulsos, pastas locais, nuvem e `CachedStorageDecorator`), `DataPortabilityService` (LWW, ZIP), `CloudlessSyncEngine`, `RichPresenceManager` (Discord IPC / Webhooks) e `PromptBuilder`.
  - **TypeScript (`src/`):** Focado em renderização DOM/Canvas (`IDocumentViewer`: `epub.js`, `pdf.js`), edição visual/assistida a 60fps (`IAnnotationToolStrategy`: `AssistedRichTextStrategy`, `tldraw`, `draw.io`) e camada de apresentação **MVVC** (`src/ui/providers`, `src/ui/hooks`, `src/ui/components`).
- **Código e Comentários 100% em Inglês:** Todo código-fonte (`src/` e `src-tauri/`), nomes de símbolos, mensagens de erro e comentários/JSDoc (quando estritamente necessários) devem ser escritos **exclusivamente em inglês**. Evite comentários óbvios nas estruturas de dados.
- **Portabilidade Desktop + iOS (`WKWebView`):** Nunca utilize `Buffer` do Node.js em `src/core/`. Utilize sempre `Uint8Array` ou `ArrayBuffer`.
- **Injeção de Dependência Pura:** Nenhuma classe em `src/core/` ou `ipdf-core` pode acessar singletons globais, `window` diretamente, banco de dados físico ou rede. Tudo entra via `constructor` / traits tipados pelas portas.
- **Paridade de Modularização Estrita (TypeScript & Rust):** É terminantemente proibido concentrar múltiplas entidades, portas, serviços ou testes em "super arquivos" monolíticos (como um único `domain.rs`, `ports.rs` ou `services.rs`). O backend Rust (`src-tauri/crates/ipdf-core/src/`) **DEVE** espelhar a mesma organização modular de um arquivo por responsabilidade usada no TypeScript:
  - `core/domain/` (`types.rs`, `book_metadata.rs`, `rich_annotation.rs`, `highlight.rs`),
  - `core/ports/` (`repository.rs`, `storage_provider.rs`, `export_strategy.rs`, `llm_provider.rs`, `presence_provider.rs`),
  - `core/services/` (`sha256_book_hasher.rs`, `highlight_manager.rs`, `data_portability_service.rs`, `cloudless_sync_engine.rs`, `prompt_builder.rs`, `rich_presence_manager.rs`),
  - `adapters/` (`storage/cached_storage_decorator.rs`, etc.),
  - `tests/` (`fakes/mod.rs` e arquivos `*_spec.rs` dedicados por domínio/serviço).
- **Frontend MVVC / MVVM Modular (`src/ui/`):** Proibido misturar IoC, gerenciamento de estado/regras e JSX em "super arquivos". Separe estritamente em:
  1. `src/ui/providers/` (Inversão de Controle / Contextos de DI),
  2. `src/ui/hooks/` (ViewModels / Custom Hooks concentrando estado e casos de uso),
  3. `src/ui/components/` (Componentes visuais puros, pequenos e reutilizáveis recebendo dados via props).
- **Zero `any` Policy:** Proibido usar `any`.
- **Cobertura de Testes Mínima (>= 80%):** Todo código em `src/core/` e `src/adapters/` deve manter no mínimo **80% de cobertura** em *lines*, *functions*, *branches* e *statements* (validado pelo `@vitest/coverage-v8`), além da suíte de testes Rust em `src-tauri/crates/ipdf-core/tests/` validada por `cargo test` e `cargo clippy -- -D warnings`.
- **Quality Gate Bloqueante:** Nenhum commit pode ser realizado sem que `npm run verify` (`format` + `lint` + `typecheck` + `test --coverage` + `verify:rust`) retorne `exit code 0`.
