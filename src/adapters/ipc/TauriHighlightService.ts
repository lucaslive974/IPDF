import { Highlight } from '@domain/Highlight';
import { type IRichAnnotation, createAssistedTextAnnotation } from '@domain/RichAnnotation';
import type { HighlightAnchor, RichAnnotationType } from '@domain/types';
import type { IHighlightService } from '@ports/IHighlightService';
import { invoke } from '@tauri-apps/api/core';

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
};

export function serializeHighlight(highlight: Highlight): SerializedHighlight {
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

export function deserializeHighlight(dto: SerializedHighlight): Highlight {
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

export class TauriHighlightService implements IHighlightService {
  public async loadBookHighlights(bookHash: string): Promise<Highlight[]> {
    const dtos = await invoke<SerializedHighlight[]>('load_book_highlights', { bookHash });
    return dtos.map(deserializeHighlight);
  }

  public async loadAllHighlights(): Promise<Highlight[]> {
    const dtos = await invoke<SerializedHighlight[]>('load_all_highlights');
    return dtos.map(deserializeHighlight);
  }

  public async saveHighlight(highlight: Highlight): Promise<void> {
    await invoke<void>('save_highlight', {
      highlight: serializeHighlight(highlight),
    });
  }

  public async deleteHighlight(highlightId: string): Promise<void> {
    await invoke<void>('delete_highlight', { highlightId });
  }
}
