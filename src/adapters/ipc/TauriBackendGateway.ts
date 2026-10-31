import { Highlight } from '../../core/domain/Highlight';
import {
  type IRichAnnotation,
  createAssistedTextAnnotation,
  createDrawioDiagramAnnotation,
  createTldrawBoardAnnotation,
} from '../../core/domain/RichAnnotation';
import type { HighlightAnchor, RichAnnotationType } from '../../core/domain/types';
import type { IBackendGateway, LLMRequest, ReadingContext } from '../../core/ports/IBackendGateway';

export type TauriInvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

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

type AnnotationDeserializer = (dto: SerializedRichAnnotation) => IRichAnnotation;

const ANNOTATION_DESERIALIZERS: Record<RichAnnotationType, AnnotationDeserializer> = {
  'assisted-markdown': (dto) => createAssistedTextAnnotation(dto.rawData, new Date(dto.updatedAt)),
  tldraw: (dto) =>
    createTldrawBoardAnnotation(dto.rawData, dto.svgPreview, new Date(dto.updatedAt)),
  drawio: (dto) =>
    createDrawioDiagramAnnotation(dto.rawData, dto.svgPreview, new Date(dto.updatedAt)),
};

export class TauriBackendGateway implements IBackendGateway {
  constructor(private readonly invokeFn: TauriInvokeFn) {}

  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    const dtos = await this.invokeFn<SerializedHighlight[]>('load_book_highlights', { bookHash });
    return dtos.map((dto) => this.deserializeHighlight(dto));
  }

  public async saveHighlight(highlight: Highlight): Promise<void> {
    await this.invokeFn<void>('save_highlight', {
      highlight: this.serializeHighlight(highlight),
    });
  }

  public async deleteHighlight(highlightId: string): Promise<void> {
    await this.invokeFn<void>('delete_highlight', { highlightId });
  }

  public async buildTermLookupRequest(
    context: ReadingContext,
    targetLanguage = 'en'
  ): Promise<LLMRequest> {
    return this.invokeFn<LLMRequest>('build_term_lookup_prompt', {
      bookTitle: context.bookTitle,
      bookAuthor: context.bookAuthor ?? null,
      chapterTitle: context.chapterTitle ?? null,
      selectedText: context.selectedText,
      surroundingContext: context.surroundingContext,
      targetLanguage,
    });
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    return this.invokeFn<string>('sync_book_workspace', { bookHash });
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
