# 01. Product Requirements Document (PRD): Active Study Book Reader (IPDF)

## 1. Visão do Produto

Um leitor de livros digitais (**EPUB** e **PDF**) multiplataforma (**Desktop: Windows, Linux, macOS** e **Mobile: iOS**) projetado especificamente para leitura densa, filosofia e estudo ativo.

O sistema opera sob os princípios **Offline-First** e **BYOC (Bring Your Own Cloud)**, integrando:
- Marca-texto polimórfico persistente e **anotações ricas por seção/trecho** (texto em Markdown, quadros brancos/desenhos livres via **tldraw** e diagramas estruturados via **draw.io**);
- Síntese de voz natural (**TTS**) sincronizada com destaque de sentença e *prefetching*;
- Tradução *in-place* e dicionário filosófico/contextual via **LLM**;
- Tutor **LLM** contextual via *streaming*;
- Compartilhamento de status de leitura em tempo real (**Discord Rich Presence** e **Webhooks customizados**);
- Portabilidade completa de dados e sincronização *serverless* (**Cloudless Sync**).

---

## 2. Stack Tecnológica Core

| Camada | Tecnologia / Biblioteca | Detalhes e Decisões Técnicas |
| :--- | :--- | :--- |
| **Runtime Multiplataforma** | **Tauri v2** | Frontend Web em TypeScript/React + Backend Nativo em Rust/C++/Swift (Desktop + iOS WKWebView). |
| **Linguagem Principal** | **TypeScript (Strict Mode)** | `strict: true`, proibição de `any`, uso exclusivo de `Uint8Array` / `ArrayBuffer` (sem `Node.js Buffer`). |
| **Renderizador EPUB** | `epub.js` ou `foliate-js` | Baseado em DOM dinâmico e *Canonical Fragment Identifier* (**CFI**). |
| **Renderizador PDF** | `pdfjs-dist` (Mozilla PDF.js) | Renderização em Canvas + TextLayer com coordenadas cartesianas normalizadas (`BoundingBox`). |
| **Anotações Ricas (Strategy + Visitor)** | Editor WYSIWYG Assistido + `tldraw` + `draw.io` | Formatação de texto assistida (negrito, sublinhado, cores, listas sem exigir conhecimento de sintaxe Markdown), quadro branco livre (`tldraw`) e diagramas (`draw.io`) abstraídos via *Strategy* e *Visitor Pattern* compondo o `HighlightManager`. |
| **Persistência Local** | **SQLite** + **Local FS** | `@tauri-apps/plugin-sql` para metadados/grifos/anotações e `@tauri-apps/plugin-fs` para binários de livros. |
| **Identidade de Obras** | **SHA-256 (`bookHash`)** | Calculado sobre o `ArrayBuffer` binário do arquivo, garantindo identidade única entre dispositivos independente do nome do arquivo. |
| **Qualidade & Testes** | **Vitest (+ Coverage v8)** + **Biome** + **TSC** | Pipeline bloqueante via `npm run verify` (`format` + `lint` + `typecheck` + `test --coverage` com **meta mínima obrigatória de 80% de cobertura**). |

---

## 3. Requisitos Funcionais (Features)

1. **Biblioteca Unificada & On-Demand Cloud:**
   Gerenciamento de arquivos `.epub` e `.pdf` locais ou sincronizados a partir de uma pasta no Google Drive do usuário, mantendo catálogo leve sincronizado e baixando os binários sob demanda (*On-Demand Caching*).
2. **Marca-Texto Polimórfico & Anotações Ricas de Seção (Strategy + Visitor):**
   - Seleção de texto com grifos em múltiplas cores e notas pessoais associadas, persistidos por `epubCfi` (no EPUB) ou array de `BoundingBox` (no PDF), com detecção de colisão/sobreposição geométrica (AABB no PDF e igualdade de CFI no EPUB).
   - **Anotações Assistidas e Gráficas na Seção/Trecho:** O usuário pode deixar anotações ricas na seção ou grifo sem precisar conhecer sintaxe técnica:
     - **Texto Rico Assistido (Markdown Transparente):** Barra de ferramentas visual pronta com comandos de **negrito, itálico, sublinhado, tachado, cores de texto/fundo, listas e títulos**, gerando Markdown/HTML estruturado nos bastidores.
     - **Desenhos e Diagramas (`tldraw` e `draw.io`):** Quadros brancos livres e diagramas estruturados vinculados diretamente à seção.
     - **Desacoplamento via Strategy & Visitor:** Cada modalidade de anotação (`AssistedRichTextStrategy`, `TldrawAnnotationStrategy`, `DrawioAnnotationStrategy`) implementa contratos próprios que compõem o `HighlightManager` e sabem interagir com a entidade `Highlight` (Double Dispatch / Visitor), mantendo o domínio 100% agnóstico das bibliotecas gráficas.
3. **Tradução In-Place & Dicionário Filosófico/Contextual:**
   Ao selecionar um termo (ex.: conceitos gregos transliterados em Platão) ou uma frase em outro idioma, o sistema consulta uma LLM injetando o contexto da obra e exibe o significado diretamente sobre a linha (usando tag `<ruby>` no EPUB ou *overlay badge* no PDF) ou via Popover.
4. **Tutor LLM Contextual:**
   Explicação profunda de passagens selecionadas via *streaming*, enviando automaticamente `[Autor + Obra + Capítulo + Parágrafo Adjacente + Trecho Selecionado]`, com cancelamento automático de requisições pendentes (`AbortController`) e possibilidade de salvar a resposta da IA diretamente como nota de um grifo.
5. **Text-to-Speech (TTS) Sincronizado:**
   Leitura em voz alta com motores neurais locais (Piper TTS / ONNX no Desktop) ou nativos (`AVSpeechSynthesizer` no iOS), destacando visualmente a frase atual, fazendo *prefetch* do áudio da próxima sentença e virando a página automaticamente.
6. **Rich Presence Multi-Provedor:**
   Transmissão da sessão de leitura (livro, autor, capítulo, página, porcentagem, capa e tempo decorrido) com *debounce* de `3000ms` e despacho resiliente (`Promise.allSettled`) para **Discord RPC** (IPC local no Desktop) e **Webhooks customizados** (HTTP POST com suporte a imagem/capa).
7. **Portabilidade de Dados e Cloudless Sync:**
   Exportação/Importação de pacotes completos (`.zip` com livros e grifos), apenas metadados (`.json`) ou notas de estudo para Obsidian (`.md`), usando resolução de conflitos *Last-Write-Wins (LWW)* baseada em timestamps (`updatedAt`).

---

## 4. Roadmap de Implementação (Milestones para os Agentes)

- **Fase 1 (Foundation & Core Contracts):**
  Setup do Tauri v2 + TypeScript + Vitest + Biome. Criação de todas as interfaces em `src/core/`, implementação das entidades (`Highlight`, `BookMetadata`), serviços de domínio (`HighlightManager`, `DataPortabilityService`, `PromptBuilder`, `ContextualAssistant`, `RichPresenceManager`, `CloudlessSyncEngine`) e dublês de teste *In-Memory* / *Spies* em `src/test/fakes/`.
- **Fase 2 (Library & EPUB Viewer):**
  Cálculo de hash SHA-256, extração de capa para `Uint8Array`, `LibraryManager`, repositórios SQLite e `EpubViewerAdapter` com suporte completo a CFI e grifos.
- **Fase 3 (Contextual Assistant & In-Place Translation):**
  Integração completa dos adaptadores para LLM (`OllamaLocalLLMProvider` e `CloudAPILLMProvider`) e injeção de anotações *in-place* nos visualizadores.
- **Fase 4 (Rich Presence & SystemBridge):**
  Implementação do comando Rust para Discord IPC (`DiscordIPCProvider`), `CustomWebhookProvider` e adaptadores concretos da fachada `SystemBridge`.
- **Fase 5 (TTS & PDF Viewer):**
  Implementação do `PdfViewerAdapter` (com limpeza de cabeçalhos e hifenização) e adaptadores `ITTSProvider` (`PiperLocalTTS`, `NativeSystemTTS`) com *prefetching* de sentenças.
- **Fase 6 (Portabilidade & Google Drive Sync):**
  Implementação das estratégias de serialização (`zip-bundle`, `json-only`, `markdown`), `GoogleDriveStorageProvider` e integração completa do `CloudlessSyncEngine`.
