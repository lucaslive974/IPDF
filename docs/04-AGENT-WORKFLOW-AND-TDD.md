# 04. Agent Engineering Guidelines: TDD, Quality Gates & Git Workflow

Este documento define as regras operacionais obrigatórias para qualquer agente de IA (Antigravity) atuando neste repositório.

---

## 1. Filosofia de Design e Testabilidade

1. **"Difícil de testar = Acoplamento Incorreto":**
   Se testar um método exigir subir uma janela do Tauri, instanciar o `epub.js`/`PDF.js` real, conectar ao SQLite em disco ou fazer chamadas de rede, **PARE IMEDIATAMENTE**. Extraia a dependência externa para uma interface em `src/core/ports/` e injete-a no construtor.
2. **Proibição de Estado Global / Singletons:**
   Nenhuma classe em `src/core/` pode acessar variáveis globais, `window` diretamente ou singletons importados estaticamente. Toda dependência deve entrar via `constructor`.
3. **Zero `any` Policy:**
   O uso de `any` é estritamente proibido. Utilize tipos estritos, Generics ou `unknown` com *type guards*.
4. **English-Only Source Code & Comments Policy:**
   Todo o código-fonte em `src/`, `src-tauri/` e `test/` (incluindo nomes de tipos, variáveis, funções, strings técnicas e quaisquer comentários) deve ser escrito **100% em inglês**. Não adicione comentários em português ou comentários redundantes em estruturas de dados autoexplicativas.
5. **Paridade de Modularização (TypeScript & Rust) e Frontend MVVC:**
   - **Proibição de "Super Arquivos" em TS e Rust:** Tanto em `src/` (TypeScript) quanto em `src-tauri/crates/ipdf-core/src/` (Rust), cada entidade de domínio, porta (interface/trait), serviço, adaptador e suíte de teste deve viver em seu próprio arquivo dedicado dentro de `core/domain/`, `core/ports/`, `core/services/`, `adapters/` e `tests/`. Nunca agrupe múltiplos serviços ou entidades em arquivos monolíticos (`domain.rs`, `services.rs`, etc.).
   - **Frontend MVVC (`src/ui/`):** Nunca crie "super arquivos" React que misturem instanciação de dependências (IoC), gerenciamento de estado (`useState`/`useEffect`), chamadas de serviços e marcação JSX extensa. Todo recurso visual deve ser dividido em:
     - **IoC Provider (`src/ui/providers/`):** Injeção do container de serviços via Context.
     - **ViewModel Hook (`src/ui/hooks/`):** Custom Hook isolando toda a lógica de estado e interação com `src/core/services/`.
     - **Reusable Presentational Components (`src/ui/components/`):** Componentes pequenos, desacoplados e orientados a `props` (sem valores hardcoded fixos quando puderem receber configuração por props).
6. **Meta Mínima de Cobertura de Testes (>= 80%):**
   É obrigatório manter **pelo menos 80% de cobertura de testes** (`lines >= 80%`, `functions >= 80%`, `branches >= 80%`, `statements >= 80%`) em `src/core/` e `src/adapters/`. O Vitest (`@vitest/coverage-v8`) está configurado com *thresholds* bloqueantes: se a cobertura cair abaixo de 80%, `npm run test` e `npm run verify` falharão automaticamente.

---

## 2. O Ciclo Obrigatório: Red -> Green -> Verify -> Commit

O agente tem autonomia para avançar nas tarefas e realizar commits no Git, mas **DEVE** cumprir estritamente os 4 passos abaixo para cada classe ou funcionalidade criada:

### Passo 1: Teste Primeiro (Red)
- **Separação Estrita em `src/test/`:** NUNCA misture arquivos `*.spec.ts` ou dublês junto aos arquivos de produção em `src/core/`, `src/adapters/` ou `src/ui/`. Todos os testes TypeScript/UI devem residir na pasta `src/test/` espelhando a estrutura de `src/` (ex.: `src/core/services/Foo.ts` -> `src/test/core/services/Foo.spec.ts`).
- Crie os dublês de teste necessários (`FakeBackendGateway`, etc.) em `src/test/fakes/`.
- Escreva o arquivo de teste unitário (`src/test/**/*.spec.ts`) validando tanto o caminho feliz quanto os casos de borda listados na Matriz de Cenários abaixo, garantindo cobertura >= 80%.

### Passo 2: Implementação Limpa (Green)
- Escreva o código de produção seguindo os contratos definidos em `docs/03-CORE-CONTRACTS.md`.

### Passo 3: Portão de Qualidade Bloqueante (Verify)
Antes de considerar qualquer arquivo pronto ou iniciar o próximo módulo, execute no terminal:

```bash
npm run verify
```

O comando `npm run verify` executa em sequência:
1. `npm run format` (`biome format --write ./src`)
2. `npm run lint` (`biome check ./src`)
3. `npm run typecheck` (`tsc --noEmit`)
4. `npm run test` (`vitest run --coverage`, exigindo >= 80% em lines, functions, branches e statements)
5. `npm run verify:rust` (`cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` + `cargo test` na crate `src-tauri/crates/ipdf-core`)

> [!CAUTION]
> **REGRA DE BLOQUEIO:** Se qualquer uma dessas 4 etapas falhar, emitir erros ou ficar abaixo de **80% de cobertura de testes**, o agente **ESTÁ PROIBIDO** de fazer commit ou avançar para a próxima tarefa. Corrija a formatação, a tipagem, o teste quebrado ou adicione casos de teste faltantes até que `npm run verify` retorne `exit code 0`.

### Passo 4: Commit Atômico (Conventional Commits)
Com o `npm run verify` 100% verde, faça um commit pequeno, atômico e focado exclusivamente na unidade recém-implementada:

- `feat(domain): implement Highlight entity with EPUB CFI and PDF AABB overlap check`
- `feat(highlights): implement HighlightManager and InMemoryHighlightRepository`
- `feat(portability): implement DataPortabilityService with Last-Write-Wins merge`
- `feat(llm): implement PromptBuilder and ContextualAssistant with AbortController`
- `feat(presence): implement RichPresenceManager with 3000ms debounce and allSettled dispatch`
- `feat(sync): implement CloudlessSyncEngine over IRemoteStorageProvider`

---

## 3. Matriz de Cenários de Testes Unitários (Vitest Frontend + Cargo Rust Backend)

| Camada | Módulo / Serviço | Suíte de Teste | Asserções Obrigatórias |
| :--- | :--- | :--- | :--- |
| **TypeScript (`src/test/`)** | **`Highlight` & `RichAnnotation`** | `src/test/core/domain/Highlight.spec.ts` | 1. `updateNote`, `changeColor`, `setRichAnnotation` e `removeRichAnnotation` atualizam `updatedAt`.<br>2. Double Dispatch (`annotation.attachTo(highlight)`) e Visitor (`highlight.acceptAnnotationVisitor(visitor)`) despacham corretamente para `visitAssistedText`, `visitTldrawBoard` e `visitDrawioDiagram` sem `switch/case`.<br>3. `overlapsWith` detecta colisão exata de CFI (EPUB) e intersecção geométrica AABB de `BoundingBox` (PDF). |
| **TypeScript (`src/test/`)** | **`AnnotationWorkbenchService` + Strategies** | `src/test/core/services/AnnotationWorkbenchService.spec.ts` | 1. Carrega grifos via `IBackendGateway` e filtra por página (`getForPage(n)`).<br>2. Aplica todos os estilos de formatação assistida (`AssistedRichTextStrategy` com Command Dispatch Map) e quadros visuais (`tldraw` / `draw.io`), persistindo cada atualização via `IBackendGateway`. |
| **TypeScript (`src/test/`)** | **`TauriBackendGateway`** | `src/test/adapters/ipc/TauriBackendGateway.spec.ts` | 1. Serializa e desserializa `Highlight` e todas as variantes de `IRichAnnotation` via mapa de desserializadores (`ANNOTATION_DESERIALIZERS`) sem `switch/if`.<br>2. Encaminha comandos IPC (`load_book_highlights`, `save_highlight`, `delete_highlight`, `build_term_lookup_prompt`, `sync_book_workspace`). |
| **Rust (`ipdf-core`)** | **`Highlight` & `RichAnnotation`** | `src-tauri/crates/ipdf-core/tests/highlight_spec.rs` | 1. Interseção AABB de PDF, colisão de CFI e Visitor/Double Dispatch em Rust. |
| **Rust (`ipdf-core`)** | **`Sha256BookHasher`** | `src-tauri/crates/ipdf-core/tests/sha256_book_hasher_spec.rs` | 1. Calcula o hash SHA-256 em *streaming* (chunks de 64 KB) produzindo o mesmo digest que o buffer completo sem alocar o arquivo inteiro em RAM. |
| **Rust (`ipdf-core`)** | **`HighlightManager`, `DataPortabilityService` & `CloudlessSyncEngine`** | `src-tauri/crates/ipdf-core/tests/cloudless_sync_and_portability_spec.rs` | 1. Merge *Last-Write-Wins (LWW)* atualiza registros locais apenas quando `incoming.updated_at > local.updated_at`.<br>2. Sincroniza `<bookHash>.highlights.json` sobre a trait unificada `StorageProvider`. |
| **Rust (`ipdf-core`)** | **`CachedStorageDecorator` & `RichPresenceManager`** | `src-tauri/crates/ipdf-core/tests/cached_storage_and_presence_spec.rs` | 1. Cacheia binários sob demanda no `local_cache` e opera *offline* quando o `primary` está indisponível.<br>2. Aplica janela de *debounce* no `RichPresenceManager` antes de notificar provedores de presença. |
| **Rust (`ipdf-core`)** | **`TtsSessionManager` & `SystemBridge`** | `src-tauri/crates/ipdf-core/tests/tts_and_system_bridge_spec.rs` | 1. Coordena `TtsProvider` com *prefetch* automático da próxima sentença.<br>2. Aciona `PowerSaveBlocker::keep_screen_awake(true/false)` e `MediaControlService::set_playback_state` automaticamente em `start_session`, `pause`, `resume` e `stop`. |
