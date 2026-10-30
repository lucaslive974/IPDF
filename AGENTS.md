# AGENTS.md — Active Study Book Reader (IPDF)

Este repositório segue uma arquitetura **Hexagonal (Ports & Adapters)** estrita com desenvolvimento guiado por testes (**TDD**). Todo agente ou subagente atuando neste projeto deve consultar a documentação modular em `docs/` antes de escrever qualquer linha de código.

## 📚 Mapa de Documentação Obrigatória

1. **[`docs/01-PRD-OVERVIEW.md`](docs/01-PRD-OVERVIEW.md)**
   Visão do produto, stack tecnológica (Tauri v2, TypeScript Strict, EPUB/PDF, SQLite, BYOC), requisitos funcionais e o Roadmap dividido em 6 fases.
2. **[`docs/02-ARCHITECTURE-UML.md`](docs/02-ARCHITECTURE-UML.md)**
   Princípios de Clean Architecture, árvore de diretórios obrigatória (`src/core/domain`, `src/core/ports`, `src/core/services`, `src/adapters`, `src/test/fakes`, `src/ui`), diagrama de classes UML e estrutura de sincronização remota (*Cloudless Sync*).
3. **[`docs/03-CORE-CONTRACTS.md`](docs/03-CORE-CONTRACTS.md)**
   Contratos TypeScript exatos e imutáveis para objetos de valor, entidades (`Highlight`, `RichAnnotation` com Visitor/Double Dispatch, `BookMetadata`) e portas (`IAnnotationToolStrategy`, `IAssistedTextFormattingStrategy`, `IRepository`, `IDocumentViewer`, `ILLMProvider`, `ITTSProvider`, `IPresenceProvider`, `ISystemBridge`, `IRemoteStorageProvider`).
4. **[`docs/04-AGENT-WORKFLOW-AND-TDD.md`](docs/04-AGENT-WORKFLOW-AND-TDD.md)**
   Regras de engenharia, ciclo obrigatório **Red -> Green -> Verify -> Commit**, política *Zero `any`*, comando bloqueante `npm run verify` e matriz de testes unitários obrigatórios no Vitest.

## ⚡ Regras de Ouro Inegociáveis

- **Portabilidade Desktop + iOS (`WKWebView`):** Nunca utilize `Buffer` do Node.js em `src/core/`. Utilize sempre `Uint8Array` ou `ArrayBuffer`.
- **Injeção de Dependência Pura:** Nenhuma classe em `src/core/` pode acessar singletons globais, `window` diretamente, banco de dados físico ou rede. Tudo entra via `constructor` tipado pelas interfaces de `src/core/ports/`.
- **Zero `any` Policy:** Proibido usar `any`.
- **Quality Gate Bloqueante:** Nenhum commit pode ser realizado sem que `npm run verify` (`format` + `lint` + `typecheck` + `test`) retorne `exit code 0`.
