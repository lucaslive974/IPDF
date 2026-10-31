# AGENTS.md — Active Study Book Reader (IPDF)

Este repositório segue uma arquitetura **Hexagonal (Ports & Adapters)** estrita com desenvolvimento guiado por testes (**TDD**). Todo agente ou subagente atuando neste projeto deve consultar a documentação modular em `docs/` antes de escrever qualquer linha de código.

## 📚 Mapa de Documentação Obrigatória

1. **[`docs/01-PRD-OVERVIEW.md`](docs/01-PRD-OVERVIEW.md)**
   Visão do produto, stack tecnológica (Tauri v2, TypeScript Strict, EPUB/PDF, SQLite, BYOC), requisitos funcionais e o Roadmap dividido em 6 fases.
2. **[`docs/02-ARCHITECTURE-UML.md`](docs/02-ARCHITECTURE-UML.md)**
   Princípios de Clean Architecture, árvore de diretórios obrigatória (`src/core/domain`, `src/core/ports`, `src/core/services`, `src/adapters`, `src/ui` e `test/` espelhando `src/` na raiz), diagrama de classes UML e estrutura de sincronização remota (*Cloudless Sync*).
3. **[`docs/03-CORE-CONTRACTS.md`](docs/03-CORE-CONTRACTS.md)**
   Contratos TypeScript exatos e imutáveis para objetos de valor, entidades (`Highlight`, `RichAnnotation` com Visitor/Double Dispatch, `BookMetadata`) e portas (`IAnnotationToolStrategy`, `IAssistedTextFormattingStrategy`, `IRepository`, `IDocumentViewer`, `ILLMProvider`, `ITTSProvider`, `IPresenceProvider`, `ISystemBridge`, `IRemoteStorageProvider`).
4. **[`docs/04-AGENT-WORKFLOW-AND-TDD.md`](docs/04-AGENT-WORKFLOW-AND-TDD.md)**
   Regras de engenharia, ciclo obrigatório **Red -> Green -> Verify -> Commit**, política *Zero `any`*, meta mínima obrigatória de **80% de cobertura de testes (Test Coverage)**, comando bloqueante `npm run verify` e matriz de testes unitários obrigatórios no Vitest.

## ⚡ Regras de Ouro Inegociáveis

- **Código e Comentários 100% em Inglês:** Todo código-fonte (`src/` e `test/`), nomes de símbolos, mensagens de erro e comentários/JSDoc (quando estritamente necessários) devem ser escritos **exclusivamente em inglês**. Evite comentários óbvios nas estruturas de dados.
- **Portabilidade Desktop + iOS (`WKWebView`):** Nunca utilize `Buffer` do Node.js em `src/core/`. Utilize sempre `Uint8Array` ou `ArrayBuffer`.
- **Injeção de Dependência Pura:** Nenhuma classe em `src/core/` pode acessar singletons globais, `window` diretamente, banco de dados físico ou rede. Tudo entra via `constructor` tipado pelas interfaces de `src/core/ports/`.
- **Frontend MVVC / MVVM Modular (`src/ui/`):** Proibido misturar IoC, gerenciamento de estado/regras e JSX em "super arquivos". Separe estritamente em:
  1. `src/ui/providers/` (Inversão de Controle / Contextos de DI),
  2. `src/ui/hooks/` (ViewModels / Custom Hooks concentrando estado e casos de uso),
  3. `src/ui/components/` (Componentes visuais puros, pequenos e reutilizáveis recebendo dados via props).
- **Zero `any` Policy:** Proibido usar `any`.
- **Cobertura de Testes Mínima (>= 80%):** Todo código em `src/core/` e `src/adapters/` deve manter no mínimo **80% de cobertura** em *lines*, *functions*, *branches* e *statements* (validado automaticamente pelo `@vitest/coverage-v8`).
- **Quality Gate Bloqueante:** Nenhum commit pode ser realizado sem que `npm run verify` (`format` + `lint` + `typecheck` + `test --coverage`) retorne `exit code 0`.
