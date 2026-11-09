# 03. Core TypeScript Contracts & Domain Specifications

Coding agents must strictly adhere to the signatures below when maintaining or extending `src/core/`.

> [!IMPORTANT]
> **Cross-Platform Compatibility:** Always use `Uint8Array` or `ArrayBuffer` instead of `Node.js Buffer` in `src/core/` to ensure full portability across Desktop and Mobile (`WKWebView` / Android WebView).

---

## 1. Value Types & Anchoring (`src/core/domain/types.ts`)

```typescript
export const BookFormat = {
  EPUB: 'epub',
  PDF: 'pdf',
} as const;

export type BookFormat = (typeof BookFormat)[keyof typeof BookFormat];

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

export type RichAnnotationType = 'assisted-markdown';

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
```

---

## 2. Domain Entities & Objects (`src/core/domain/`)

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
  pageOffsetRatio?: number;
  coverImageBuffer?: Uint8Array;
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string;
  description?: string;
  tags: string[];
  lastReadAt: Date;
  updatedAt: Date;
}
```

### `src/core/domain/PageWindow.ts`

```typescript
export interface PageWindow {
  readonly startPage: number;
  readonly count: number;
}

export const INITIAL_BACKWARD_PAGES = 5;
export const INITIAL_ACTIVE_PAGES = 5;
export const INITIAL_FORWARD_PAGES = 5;

export function calculatePageWindow(targetPage: number, totalPages?: number): PageWindow;
```

### `src/core/domain/RichAnnotation.ts`

```typescript
import type { RichAnnotationType } from './types';

export interface AssistedTextAnnotationData {
  readonly type: 'assisted-markdown';
  readonly rawData: string;
  readonly svgPreview?: undefined;
  readonly updatedAt: Date;
}

export type IRichAnnotation = AssistedTextAnnotationData;

export function createAssistedTextAnnotation(
  rawData: string,
  updatedAt: Date = new Date()
): AssistedTextAnnotationData;

export type AnnotationFormatterMap<R> = {
  readonly [K in RichAnnotationType]: (annotation: Extract<IRichAnnotation, { type: K }>) => R;
};

export function formatRichAnnotation<R>(
  annotation: IRichAnnotation,
  formatterMap: AnnotationFormatterMap<R>
): R;
```

### `src/core/domain/Highlight.ts`

```typescript
import {
  type AnnotationFormatterMap,
  type IRichAnnotation,
  formatRichAnnotation,
} from './RichAnnotation';
import { BookFormat, type HighlightAnchor, type RichAnnotationType } from './types';

export class Highlight {
  private readonly annotationsMap = new Map<RichAnnotationType, IRichAnnotation>();

  constructor(
    public readonly id: string,
    public readonly bookHash: string,
    public text: string,
    public color: string,
    public readonly anchor: HighlightAnchor,
    public note = '',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    initialAnnotations: IRichAnnotation[] = []
  );

  public updateNote(newNote: string): void;
  public changeColor(newColor: string): void;
  public setRichAnnotation(annotation: IRichAnnotation): void;
  public getRichAnnotation(type: RichAnnotationType): IRichAnnotation | undefined;
  public getAllRichAnnotations(): IRichAnnotation[];
  public removeRichAnnotation(type: RichAnnotationType): void;
  public formatAnnotations<R>(formatterMap: AnnotationFormatterMap<R>): R[];
  public overlapsWith(otherAnchor: HighlightAnchor): boolean;
}
```

---

## 3. IPC Service Ports (`src/core/ports/`)

### `src/core/ports/ILibraryService.ts`

```typescript
import type { BookMetadata } from '../domain/BookMetadata';
import type { BookFormat } from '../domain/types';

export interface ImportLibraryBookInput {
  readonly rawBytes: Uint8Array;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly totalPages: number;
  readonly coverImageUrl?: string;
}

export interface UpdateBookMetadataInput {
  readonly title: string;
  readonly author: string;
  readonly tags: readonly string[];
  readonly description?: string;
}

export interface ILibraryService {
  listLibraryBooks(): Promise<BookMetadata[]>;
  getStartupBook(): Promise<BookMetadata | null>;
  openBookFile(filePath: string): Promise<BookMetadata>;
  openBookFiles?(filePaths: readonly string[]): Promise<BookMetadata[]>;
  importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata>;
  renameBook(bookHash: string, newTitle: string): Promise<BookMetadata>;
  updateBookMetadata(bookHash: string, input: UpdateBookMetadataInput): Promise<BookMetadata>;
  listAuthors(): Promise<string[]>;
  listTags(): Promise<string[]>;
  deleteBook(bookHash: string): Promise<boolean>;
  pickAndImportBook?(): Promise<BookMetadata | null>;
  updateBookCover?(bookHash: string, coverImageUrl: string): Promise<BookMetadata>;
}
```

### `src/core/ports/IReaderService.ts`

```typescript
import type { BookMetadata } from '../domain/BookMetadata';

export interface DocumentPage {
  readonly pageNumber: number;
  readonly chapterTitle: string;
  readonly paragraphs: string[];
  readonly cfiBase: string;
}

export interface ReadingContext {
  readonly bookTitle: string;
  readonly bookAuthor?: string;
  readonly chapterTitle?: string;
  readonly selectedText: string;
  readonly surroundingContext: string;
}

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature: number;
  readonly maxTokens: number;
}

export interface IReaderService {
  readBookBinary(bookHash: string): Promise<Uint8Array>;
  getBookPages(bookHash: string, startPage: number, count: number): Promise<DocumentPage[]>;
  updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number,
    pageOffsetRatio?: number
  ): Promise<BookMetadata>;
  getBookFilePath(bookHash: string): Promise<string | null>;
  buildTermLookupRequest(context: ReadingContext, targetLanguage?: string): Promise<LLMRequest>;
}
```

### `src/core/ports/IHighlightService.ts`

```typescript
import type { Highlight } from '../domain/Highlight';

export interface IHighlightService {
  loadBookHighlights(bookHash: string): Promise<Highlight[]>;
  loadAllHighlights(): Promise<Highlight[]>;
  saveHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
}
```

### `src/core/ports/IPresenceService.ts`

```typescript
export interface PresenceHealthStatus {
  readonly ok: boolean;
  readonly message: string;
}

export interface ReadingPresenceInput {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle?: string;
  readonly currentPage: number;
  readonly totalPages: number;
}

export interface IPresenceService {
  setDiscordPresenceEnabled(enabled: boolean): Promise<void>;
  clearRichPresence(): Promise<void>;
  updateLibraryPresence(totalBooks: number): Promise<void>;
  updateAnnotationsPresence(totalAnnotations: number): Promise<void>;
  updateReadingPresence(input: ReadingPresenceInput): Promise<void>;
  getDiscordPresenceHealth(): Promise<PresenceHealthStatus>;
}
```

### `src/core/ports/ISettingsService.ts`

```typescript
export interface PlatformInfo {
  readonly platform: string;
  readonly configDir: string;
  readonly dataDir: string;
  readonly cacheDir: string;
  readonly databasePath: string;
  readonly supportsDiscordPresence: boolean;
}

export interface ISettingsService {
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
  syncBookWorkspace(bookHash: string): Promise<string>;
  getPlatformInfo(): Promise<PlatformInfo>;
}
```

---

## 4. Document Viewer Ports (`src/core/ports/`)

### `src/core/ports/IDocumentViewer.ts` & `IDocumentViewerFactory.ts`

```typescript
import type { BookFormat, PageInfo } from '../domain/types';
import type { DocumentPage } from './IReaderService';

export interface IDocumentViewer {
  render(container: HTMLElement, fileData: ArrayBuffer | string): Promise<void>;
  destroy(): void;

  goToPage(target: number | string): Promise<void>;
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  getCurrentPage(): PageInfo;

  getPage(pageNumber: number): DocumentPage | null;
  getPagesChunk(startPage: number, count: number): DocumentPage[];
  setPages(pages: DocumentPage[]): void;

  onPageChanged(callback: (pageInfo: PageInfo) => void): void;
}

export interface IDocumentViewerFactory {
  getViewer(format: BookFormat): IDocumentViewer;
}
```

### `src/core/ports/IEpubViewer.ts`

```typescript
import type { IDocumentViewer } from './IDocumentViewer';

export interface EpubChapterDescriptor {
  readonly title: string;
  readonly cfiBase: string;
  readonly content: string;
}

export interface IEpubViewer extends IDocumentViewer {
  getChapters(): EpubChapterDescriptor[];
  getParagraphsForChapter(index?: number): string[];
}
```

### `src/core/ports/IPdfViewer.ts` & `IPdfEngine.ts`

```typescript
import type { IDocumentViewer } from './IDocumentViewer';
import type { PdfPageProxy } from './IPdfEngine';

export interface IPdfViewer extends IDocumentViewer {
  renderPageCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale?: number
  ): Promise<{ width: number; height: number }>;

  renderPageTextLayer(pageNumber: number, container: HTMLElement, scale?: number): Promise<void>;

  cancelPageRender?(canvas?: HTMLCanvasElement | null, container?: HTMLElement | null): void;

  getPageProxy(pageNumber: number): Promise<PdfPageProxy | null>;
}
```
