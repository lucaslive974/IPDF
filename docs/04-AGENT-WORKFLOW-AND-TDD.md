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
4. **Meta Mínima de Cobertura de Testes (>= 80%):**
   É obrigatório manter **pelo menos 80% de cobertura de testes** (`lines >= 80%`, `functions >= 80%`, `branches >= 80%`, `statements >= 80%`) em `src/core/` e `src/adapters/`. O Vitest (`@vitest/coverage-v8`) está configurado com *thresholds* bloqueantes: se a cobertura cair abaixo de 80%, `npm run test` e `npm run verify` falharão automaticamente.

---

## 2. O Ciclo Obrigatório: Red -> Green -> Verify -> Commit

O agente tem autonomia para avançar nas tarefas e realizar commits no Git, mas **DEVE** cumprir estritamente os 4 passos abaixo para cada classe ou funcionalidade criada:

### Passo 1: Teste Primeiro (Red)
- Crie os dublês de teste necessários (`InMemoryRepository`, `FakeProvider`, `Spy`) em `src/test/fakes/`.
- Escreva o arquivo de teste unitário (`*.spec.ts`) validando tanto o caminho feliz quanto os casos de borda listados na Matriz de Cenários abaixo, garantindo cobertura >= 80%.

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

## 3. Matriz de Cenários que DEVEM Possuir Testes Unitários (`Vitest`)

| Serviço / Entidade | Dublê de Teste (`src/test/fakes/`) | Asserções Obrigatórias no `.spec.ts` |
| :--- | :--- | :--- |
| **`Highlight` & `RichAnnotation`** | N/A (Entidades Puras + Visitor) | 1. `updateNote`, `changeColor`, `setRichAnnotation` e `removeRichAnnotation` atualizam `updatedAt`.<br>2. Double Dispatch (`annotation.attachTo(highlight)`) e Visitor (`highlight.acceptAnnotationVisitor(visitor)`) despacham corretamente para `visitAssistedText`, `visitTldrawBoard` e `visitDrawioDiagram` sem `switch/case`.<br>3. `overlapsWith` detecta colisão exata de CFI (EPUB) e intersecção geométrica AABB de `BoundingBox` (PDF). |
| **`HighlightManager` + Strategies** | `InMemoryHighlightRepository`, `AssistedRichTextStrategy`, `FakeDiagramStrategy` | 1. Carrega grifos do livro no cache interno e filtra por página via `getForPage(n)`.<br>2. Composição de `IAnnotationToolStrategy`: delega comandos de formatação assistida (negrito, sublinhado, cores, listas sem exigir sintaxe Markdown do usuário) e diagramas (`tldraw`/`draw.io`) para a estratégia registrada e persiste no repositório. |
| **`DataPortabilityService`** | `InMemoryBookRepository`, `InMemoryHighlightRepository`, `InMemoryFileStorage` | 1. Exportação com `includeBookFiles: false` omite binários.<br>2. Importação com regra `last-write-wins` atualiza registros locais apenas quando `incoming.updatedAt > local.updatedAt`.<br>3. Restaura binários ausentes sem sobrescrever arquivos existentes. |
| **`ContextualAssistant`** | `MockLLMProvider` | 1. `PromptBuilder` inclui título, autor, capítulo e `surroundingContext`.<br>2. Nova chamada a `lookupTerm` ou `explainPassage` dispara `abort()` na requisição anterior pendente. |
| **`RichPresenceManager`** | `SpyPresenceProvider` + `vi.useFakeTimers()` | 1. Múltiplas chamadas a `updateActivity` dentro de `3000ms` resultam em apenas 1 chamada real aos provedores.<br>2. Falha/Exceção em um provedor não impede a atualização dos demais (`Promise.allSettled`). |
| **`CloudlessSyncEngine`** | `InMemoryRemoteStorageProvider` | 1. Baixa `<bookHash>.highlights.json`, executa merge LWW via `DataPortabilityService` e faz upload do JSON atualizado.<br>2. Ignora execução sem lançar erro caso `isAuthenticated()` seja `false`. |
