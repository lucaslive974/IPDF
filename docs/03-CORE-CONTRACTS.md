# 03. Core TypeScript Contracts & Domain Specifications

Os agentes de código devem respeitar integralmente as assinaturas abaixo ao implementar `src/core/`.

> [!IMPORTANT]
> **Nota de Compatibilidade Multiplataforma:** Sempre utilize `Uint8Array` ou `ArrayBuffer` em vez de `Node.js Buffer` para garantir compatibilidade total entre Desktop e iOS (`WKWebView`).

---

## 1. Tipos de Valor e Ancoragem (`src/core/domain/types.ts`)

```typescript
export type BookFormat = 'epub' | 'pdf';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightAnchor {
  format: BookFormat;
  pageNumber: number;
  epubCfi?: string;
  pdfRects?: BoundingBox[];
}

export interface TextSelection {
  text: string;
  surroundingContext: string;
  anchor: HighlightAnchor;
  clientRect: DOMRect;
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  chapterTitle?: string;
  percentage: number;
}

export interface SentenceNode {
  id: string;
  text: string;
  anchor: HighlightAnchor;
}

export type RichAnnotationType = 'assisted-markdown' | 'tldraw' | 'drawio';

export type TextFormatStyle =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'strikethrough' }
  | { kind: 'textColor'; colorHex: string }
  | { kind: 'backgroundColor'; colorHex: string }
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | { kind: 'bulletList' }
  | { kind: 'orderedList' }
  | { kind: 'blockquote' };

export type AssistedMarkdownCommand =
  | {
      target: 'assisted-markdown';
      action: 'insert-text';
      text: string;
    }
  | {
      target: 'assisted-markdown';
      action: 'replace-text';
      text: string;
    }
  | {
      target: 'assisted-markdown';
      action: 'apply-format';
      selectionRange: { start: number; end: number };
      formatStyle: TextFormatStyle;
    };

export type TldrawCommand =
  | {
      target: 'tldraw';
      action: 'save-snapshot';
      snapshotJson: string;
      svgPreview?: string;
    }
  | {
      target: 'tldraw';
      action: 'clear-canvas';
      svgPreview?: string;
    };

export type DrawioCommand =
  | {
      target: 'drawio';
      action: 'save-diagram';
      xmlOrJsonDiagram: string;
      svgPreview?: string;
    }
  | {
      target: 'drawio';
      action: 'clear-diagram';
      svgPreview?: string;
    };

export type AnnotationCommand = AssistedMarkdownCommand | TldrawCommand | DrawioCommand;
```

---

## 2. Entidades `Highlight`, `RichAnnotation` (Visitor) e Metadados (`src/core/domain/BookMetadata.ts`, `src/core/domain/RichAnnotation.ts` & `src/core/domain/Highlight.ts`)

### `src/core/domain/BookMetadata.ts`

```typescript
import type { BookFormat } from './types';

export interface BookMetadata {
  bookHash: string;
  title: string;
  author: string;
  format: BookFormat;
  currentPage: number;
  totalPages: number;
  percentage: number;
  isDownloadedLocally: boolean;
  remoteFileId?: string;
  coverImageBuffer?: Uint8Array;
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string;
  lastReadAt: Date;
  updatedAt: Date;
}
```

### `src/core/domain/RichAnnotation.ts` (Visitor Pattern + Double Dispatch)

```typescript
import type { RichAnnotationType } from './types';
import type { Highlight } from './Highlight';

export interface IAnnotationVisitor<R = void> {
  visitAssistedText(annotation: AssistedTextAnnotation): R;
  visitTldrawBoard(annotation: TldrawBoardAnnotation): R;
  visitDrawioDiagram(annotation: DrawioDiagramAnnotation): R;
}

export interface IRichAnnotation {
  readonly type: RichAnnotationType;
  readonly rawData: string;
  readonly svgPreview?: string;
  readonly updatedAt: Date;
  accept<R>(visitor: IAnnotationVisitor<R>): R;
  attachTo(highlight: Highlight): void;
}

export class AssistedTextAnnotation implements IRichAnnotation {
  public readonly type = 'assisted-markdown' as const;
  constructor(
    public readonly rawData: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitAssistedText(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
    highlight.updateNote(this.rawData);
  }
}

export class TldrawBoardAnnotation implements IRichAnnotation {
  public readonly type = 'tldraw' as const;
  constructor(
    public readonly rawData: string,
    public readonly svgPreview?: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitTldrawBoard(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
  }
}

export class DrawioDiagramAnnotation implements IRichAnnotation {
  public readonly type = 'drawio' as const;
  constructor(
    public readonly rawData: string,
    public readonly svgPreview?: string,
    public readonly updatedAt: Date = new Date()
  ) {}

  public accept<R>(visitor: IAnnotationVisitor<R>): R {
    return visitor.visitDrawioDiagram(this);
  }

  public attachTo(highlight: Highlight): void {
    highlight.setRichAnnotation(this);
  }
}
```

### `src/core/domain/Highlight.ts`

```typescript
import type { IAnnotationVisitor, IRichAnnotation } from './RichAnnotation';
import type { HighlightAnchor, RichAnnotationType } from './types';

export class Highlight {
  private readonly annotationsMap = new Map<RichAnnotationType, IRichAnnotation>();

  constructor(
    public readonly id: string,
    public readonly bookHash: string,
    public text: string,
    public color: string,
    public readonly anchor: HighlightAnchor,
    public note: string = '',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    initialAnnotations: IRichAnnotation[] = []
  ) {
    for (const annotation of initialAnnotations) {
      this.annotationsMap.set(annotation.type, annotation);
    }
  }

  public updateNote(newNote: string): void {
    this.note = newNote.trim();
    this.updatedAt = new Date();
  }

  public changeColor(newColor: string): void {
    this.color = newColor;
    this.updatedAt = new Date();
  }

  public setRichAnnotation(annotation: IRichAnnotation): void {
    this.annotationsMap.set(annotation.type, annotation);
    this.updatedAt = new Date();
  }

  public getRichAnnotation(type: RichAnnotationType): IRichAnnotation | undefined {
    return this.annotationsMap.get(type);
  }

  public getAllRichAnnotations(): IRichAnnotation[] {
    return Array.from(this.annotationsMap.values());
  }

  public removeRichAnnotation(type: RichAnnotationType): void {
    if (this.annotationsMap.delete(type)) {
      this.updatedAt = new Date();
    }
  }

  public acceptAnnotationVisitor<R>(visitor: IAnnotationVisitor<R>): R[] {
    return this.getAllRichAnnotations().map((annotation) => annotation.accept(visitor));
  }

  public overlapsWith(otherAnchor: HighlightAnchor): boolean {
    if (this.anchor.format !== otherAnchor.format || this.anchor.pageNumber !== otherAnchor.pageNumber) {
      return false;
    }
    if (this.anchor.format === 'epub') {
      return Boolean(this.anchor.epubCfi && this.anchor.epubCfi === otherAnchor.epubCfi);
    }
    if (this.anchor.format === 'pdf' && this.anchor.pdfRects && otherAnchor.pdfRects) {
      return this.anchor.pdfRects.some((r1) =>
        otherAnchor.pdfRects!.some(
          (r2) =>
            r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y
        )
      );
    }
    return false;
  }
}
```

---

## 3. Portas de Estratégia de Anotação (`src/core/ports/IAnnotationStrategy.ts`) e Repositório (`src/core/ports/IRepository.ts`)

### `src/core/ports/IAnnotationStrategy.ts`

```typescript
import type { Highlight } from '../domain/Highlight';
import type { IRichAnnotation } from '../domain/RichAnnotation';
import type { AnnotationCommand, RichAnnotationType, TextFormatStyle } from '../domain/types';

export interface IAnnotationToolStrategy {
  readonly type: RichAnnotationType;
  applyToHighlight(highlight: Highlight, command: AnnotationCommand): Promise<IRichAnnotation>;
  serialize(annotation: IRichAnnotation): string;
  deserialize(rawData: string, updatedAt?: Date, svgPreview?: string): IRichAnnotation;
}

export interface IAssistedTextFormattingStrategy extends IAnnotationToolStrategy {
  readonly type: 'assisted-markdown';
  formatSelection(
    currentContent: string,
    range: { start: number; end: number },
    style: TextFormatStyle
  ): string;
}
```

### `src/core/ports/IRepository.ts`

```typescript
import type { Highlight } from '../domain/Highlight';

export interface IRepository<T, ID = string> {
  save(entity: T): Promise<void>;
  findById(id: ID): Promise<T | null>;
  update(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface IHighlightRepository extends IRepository<Highlight, string> {
  findByBook(bookHash: string): Promise<Highlight[]>;
  findByBookAndPage(bookHash: string, pageNumber: number): Promise<Highlight[]>;
  searchByTextOrNote(bookHash: string, query: string): Promise<Highlight[]>;
}
```

---

## 4. Porta de Visualização (`src/core/ports/IDocumentViewer.ts`)

```typescript
import type { Highlight } from '../domain/Highlight';
import type { HighlightAnchor, PageInfo, SentenceNode, TextSelection } from '../domain/types';

export interface IDocumentViewer {
  render(container: HTMLElement, fileData: ArrayBuffer): Promise<void>;
  destroy(): void;

  goToPage(target: number | string): Promise<void>;
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  getCurrentPage(): PageInfo;

  getSelection(): TextSelection | null;
  clearSelection(): void;
  renderHighlights(highlights: Highlight[]): void;
  eraseHighlightFromDOM(highlightId: string): void;
  injectInlineAnnotation(anchor: HighlightAnchor, shortText: string, tooltipDetails?: string): void;

  extractVisibleSentences(): Promise<SentenceNode[]>;
  setActiveTTSSentence(sentenceId: string | null): void;

  onPageChanged(callback: (pageInfo: PageInfo) => void): void;
  onTextSelected(callback: (selection: TextSelection | null) => void): void;
  onHighlightClicked(callback: (highlight: Highlight, rect: DOMRect) => void): void;
}
```

---

## 5. Porta de Assistente LLM e Tradução (`src/core/ports/ILLMProvider.ts`)

```typescript
export interface ReadingContext {
  bookTitle: string;
  bookAuthor: string;
  chapterTitle?: string;
  selectedText: string;
  surroundingContext: string;
}

export interface LLMRequest {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}

export interface TermDefinition {
  term: string;
  shortMeaningInContext: string;
  detailedDefinition: string;
  etymologyOrOriginal?: string;
  synonymsInContext: string[];
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  translatorNotes?: string;
}

export interface ILLMProvider {
  readonly providerName: string;
  generateText(request: LLMRequest, signal?: AbortSignal): Promise<string>;
  generateStructured<T>(request: LLMRequest, jsonSchema?: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
  streamText(request: LLMRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<string>;
}
```

---

## 6. Porta de Síntese de Voz (`src/core/ports/ITTSProvider.ts`)

```typescript
export interface SpeakOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSBoundaryEvent {
  charIndex: number;
  charLength: number;
  word: string;
}

export interface ITTSProvider {
  initialize(): Promise<void>;
  speak(text: string, options?: SpeakOptions): Promise<void>;
  prefetch?(text: string, options?: SpeakOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;

  onWordBoundary(callback: (event: TTSBoundaryEvent) => void): void;
  onSentenceEnd(callback: () => void): void;
  onError(callback: (err: Error) => void): void;
}
```

---

## 7. Portas de Presença Social e SystemBridge (`src/core/ports/IPresenceProvider.ts` & `src/core/ports/ISystemBridge.ts`)

### `src/core/ports/IPresenceProvider.ts`

```typescript
export interface ReadingActivity {
  bookHash: string;
  bookTitle: string;
  bookAuthor: string;
  chapterTitle?: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  state: 'reading' | 'listening_tts' | 'annotating' | 'paused';
  sessionStartedAt: Date;
  coverImageBuffer?: Uint8Array;
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string;
}

export interface IPresenceProvider {
  readonly id: string;
  readonly name: string;
  isEnabled: boolean;
  connect(): Promise<void>;
  publishActivity(activity: ReadingActivity): Promise<void>;
  clearActivity(): Promise<void>;
  disconnect(): Promise<void>;
}
```

### `src/core/ports/ISystemBridge.ts`

```typescript
import type { BookFormat } from '../domain/types';

export type PlaybackState = 'playing' | 'paused' | 'none';

export interface INotificationService {
  requestPermission(): Promise<boolean>;
  notify(title: string, body: string, icon?: string): Promise<void>;
}

export interface IMediaControlService {
  setMetadata(bookTitle: string, author: string, chapter?: string, coverBuffer?: Uint8Array): void;
  setPlaybackState(state: PlaybackState): void;
  onPlay(callback: () => void): void;
  onPause(callback: () => void): void;
  onNextSentence(callback: () => void): void;
  onPrevSentence(callback: () => void): void;
}

export interface IPowerSaveBlocker {
  keepScreenAwake(enable: boolean): Promise<void>;
}

export interface IClipboardService {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface IFileStorageService {
  readBookBinary(bookHash: string): Promise<ArrayBuffer>;
  writeBookBinary(bookHash: string, data: ArrayBuffer, ext: BookFormat): Promise<string>;
  hasBookBinary(bookHash: string): Promise<boolean>;
}
```

---

## 8. Portas de Portabilidade e Cloudless Sync (`src/core/ports/IRemoteStorageProvider.ts`)

```typescript
import type { BookMetadata } from '../domain/BookMetadata';
import type { Highlight } from '../domain/Highlight';

export interface SyncPayload {
  schemaVersion: number;
  exportedAt: Date;
  deviceId: string;
  books: BookMetadata[];
  highlights: Highlight[];
  deletedIds?: string[];
  binaries?: Map<string, ArrayBuffer>;
}

export interface ExportOptions {
  bookHashes?: string[];
  includeBookFiles: boolean;
  format: 'zip-bundle' | 'json-only' | 'markdown';
}

export type ConflictResolution = 'last-write-wins' | 'keep-local' | 'keep-imported';

export interface ImportReport {
  booksImported: number;
  booksUpdated: number;
  highlightsAdded: number;
  highlightsUpdated: number;
  binariesRestored: number;
  conflictsResolved: number;
}

export interface IExportStrategy {
  serialize(payload: SyncPayload): Promise<Uint8Array | string>;
  deserialize(raw: Uint8Array | string): Promise<SyncPayload>;
}

export interface RemoteFileEntry {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  modifiedAt: Date;
}

export interface IRemoteStorageProvider {
  readonly providerId: string;
  authenticate(): Promise<boolean>;
  isAuthenticated(): boolean;
  setRootFolder(folderId: string): Promise<void>;
  listFiles(subfolder?: string): Promise<RemoteFileEntry[]>;
  findFileByName(fileName: string): Promise<RemoteFileEntry | null>;
  downloadFile(remoteId: string, onProgress?: (pct: number) => void): Promise<Uint8Array>;
  uploadFile(fileName: string, data: Uint8Array | string, mimeType: string): Promise<RemoteFileEntry>;
}
```
