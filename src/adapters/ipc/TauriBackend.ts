import { invoke } from '@tauri-apps/api/core';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { Highlight } from '../../core/domain/Highlight';
import {
  type IRichAnnotation,
  createAssistedTextAnnotation,
  createDrawioDiagramAnnotation,
  createTldrawBoardAnnotation,
} from '../../core/domain/RichAnnotation';
import type { BookFormat, HighlightAnchor, RichAnnotationType } from '../../core/domain/types';
import type {
  BackendService,
  DocumentPage,
  ImportLibraryBookInput,
  LLMRequest,
  ReadingContext,
} from '../../core/ports/IBackendGateway';

export interface SerializedRichAnnotation {
  readonly type: RichAnnotationType;
  readonly rawData: string;
  readonly svgPreview?: string;
  readonly updatedAt: string;
}

export interface SerializedHighlight {
  readonly id: string;
  readonly bookHash: string;
  readonly text: string;
  readonly color: string;
  readonly anchor: HighlightAnchor;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly annotations: SerializedRichAnnotation[];
}

export interface SerializedBookMetadata {
  readonly bookHash: string;
  readonly title: string;
  readonly author: string;
  readonly format: BookFormat;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly percentage: number;
  readonly coverImageUrl?: string;
  readonly lastReadAtMs: number;
  readonly updatedAtMs: number;
}

type AnnotationDeserializer = (dto: SerializedRichAnnotation) => IRichAnnotation;

const ANNOTATION_DESERIALIZERS: Record<RichAnnotationType, AnnotationDeserializer> = {
  'assisted-markdown': (dto) => createAssistedTextAnnotation(dto.rawData, new Date(dto.updatedAt)),
  tldraw: (dto) =>
    createTldrawBoardAnnotation(dto.rawData, dto.svgPreview, new Date(dto.updatedAt)),
  drawio: (dto) =>
    createDrawioDiagramAnnotation(dto.rawData, dto.svgPreview, new Date(dto.updatedAt)),
};

export class TauriBackend implements BackendService {
  public async listLibraryBooks(): Promise<BookMetadata[]> {
    const dtos = await invoke<SerializedBookMetadata[]>('list_library_books');
    return dtos.map((dto) => this.deserializeBookMetadata(dto));
  }

  public async readBookBinary(bookHash: string): Promise<Uint8Array> {
    const bytes = await invoke<number[]>('read_book_binary', { bookHash });
    return new Uint8Array(bytes);
  }

  public async getBookPages(
    bookHash: string,
    startPage: number,
    count: number
  ): Promise<DocumentPage[]> {
    return invoke<DocumentPage[]>('get_book_pages', {
      bookHash,
      startPage,
      count,
    });
  }

  public async importLibraryBook(input: ImportLibraryBookInput): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('import_library_book', {
      rawBytes: Array.from(input.rawBytes),
      title: input.title,
      author: input.author,
      format: input.format,
      totalPages: input.totalPages,
      coverImageUrl: input.coverImageUrl ?? null,
    });
    return this.deserializeBookMetadata(dto);
  }

  public async updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number
  ): Promise<BookMetadata> {
    const dto = await invoke<SerializedBookMetadata>('update_book_progress', {
      bookHash,
      currentPage,
      totalPages,
    });
    return this.deserializeBookMetadata(dto);
  }

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    const dtos = await invoke<SerializedHighlight[]>('load_book_highlights', { bookHash });
    return dtos.map((dto) => this.deserializeHighlight(dto));
  }

  public async saveHighlight(highlight: Highlight): Promise<void> {
    await invoke<void>('save_highlight', {
      highlight: this.serializeHighlight(highlight),
    });
  }

  public async deleteHighlight(highlightId: string): Promise<void> {
    await invoke<void>('delete_highlight', { highlightId });
  }

  public async buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage = 'en'
  ): Promise<LLMRequest> {
    return invoke<LLMRequest>('build_term_lookup_prompt', {
      bookTitle: context.bookTitle,
      bookAuthor: context.bookAuthor ?? null,
      chapterTitle: context.chapterTitle ?? null,
      selectedText: context.selectedText,
      surroundingContext: context.surroundingContext,
      targetLanguage,
    });
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    return invoke<string>('sync_book_workspace', { bookHash });
  }

  private deserializeBookMetadata(dto: SerializedBookMetadata): BookMetadata {
    return {
      bookHash: dto.bookHash,
      title: dto.title,
      author: dto.author,
      format: dto.format,
      currentPage: dto.currentPage,
      totalPages: dto.totalPages,
      percentage: dto.percentage,
      coverImageUrl: dto.coverImageUrl,
      lastReadAt: new Date(dto.lastReadAtMs),
      updatedAt: new Date(dto.updatedAtMs),
    };
  }

  private serializeHighlight(highlight: Highlight): SerializedHighlight {
    return {
      id: highlight.id,
      bookHash: highlight.bookHash,
      text: highlight.text,
      color: highlight.color,
      anchor: highlight.anchor,
      note: highlight.note,
      createdAt: highlight.createdAt.toISOString(),
      updatedAt: highlight.updatedAt.toISOString(),
      annotations: highlight.getAllRichAnnotations().map((ann) => ({
        type: ann.type,
        rawData: ann.rawData,
        svgPreview: ann.svgPreview,
        updatedAt: ann.updatedAt.toISOString(),
      })),
    };
  }

  private deserializeHighlight(dto: SerializedHighlight): Highlight {
    const annotations = dto.annotations.map((annDto) =>
      ANNOTATION_DESERIALIZERS[annDto.type](annDto)
    );
    return new Highlight(
      dto.id,
      dto.bookHash,
      dto.text,
      dto.color,
      dto.anchor,
      dto.note,
      new Date(dto.createdAt),
      new Date(dto.updatedAt),
      annotations
    );
  }
}

export const TauriBackendGateway = TauriBackend;
