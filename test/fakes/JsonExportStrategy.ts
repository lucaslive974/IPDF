import type { BookMetadata } from '../../src/core/domain/BookMetadata';
import { Highlight } from '../../src/core/domain/Highlight';
import {
  AssistedTextAnnotation,
  DrawioDiagramAnnotation,
  type IRichAnnotation,
  TldrawBoardAnnotation,
} from '../../src/core/domain/RichAnnotation';
import type { HighlightAnchor, RichAnnotationType } from '../../src/core/domain/types';
import type { IExportStrategy, SyncPayload } from '../../src/core/ports/IRemoteStorageProvider';

interface SerializedAnnotation {
  type: RichAnnotationType;
  rawData: string;
  svgPreview?: string;
  updatedAt: string;
}

interface SerializedHighlight {
  id: string;
  bookHash: string;
  text: string;
  color: string;
  anchor: HighlightAnchor;
  note: string;
  createdAt: string;
  updatedAt: string;
  annotations: SerializedAnnotation[];
}

interface SerializedBook extends Omit<BookMetadata, 'lastReadAt' | 'updatedAt'> {
  lastReadAt: string;
  updatedAt: string;
}

interface SerializedPayload {
  schemaVersion: number;
  exportedAt: string;
  deviceId: string;
  books: SerializedBook[];
  highlights: SerializedHighlight[];
  deletedIds?: string[];
  binaries?: Record<string, number[]>;
}

export class JsonExportStrategy implements IExportStrategy {
  public async serialize(payload: SyncPayload): Promise<string> {
    const binariesObj: Record<string, number[]> | undefined = payload.binaries
      ? Object.fromEntries(
          Array.from(payload.binaries.entries()).map(([hash, buf]) => [
            hash,
            Array.from(new Uint8Array(buf)),
          ])
        )
      : undefined;

    const serialized: SerializedPayload = {
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt.toISOString(),
      deviceId: payload.deviceId,
      books: payload.books.map((b) => ({
        ...b,
        lastReadAt: b.lastReadAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      highlights: payload.highlights.map((h) => ({
        id: h.id,
        bookHash: h.bookHash,
        text: h.text,
        color: h.color,
        anchor: h.anchor,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
        annotations: h.getAllRichAnnotations().map((a) => ({
          type: a.type,
          rawData: a.rawData,
          svgPreview: a.svgPreview,
          updatedAt: a.updatedAt.toISOString(),
        })),
      })),
      deletedIds: payload.deletedIds,
      binaries: binariesObj,
    };

    return JSON.stringify(serialized);
  }

  public async deserialize(raw: Uint8Array | string): Promise<SyncPayload> {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    const parsed = JSON.parse(text) as SerializedPayload;

    const books: BookMetadata[] = parsed.books.map((b) => ({
      ...b,
      lastReadAt: new Date(b.lastReadAt),
      updatedAt: new Date(b.updatedAt),
    }));

    const highlights: Highlight[] = parsed.highlights.map((h) => {
      const annotations: IRichAnnotation[] = (h.annotations ?? []).map((a) => {
        const updatedAt = new Date(a.updatedAt);
        if (a.type === 'assisted-markdown') {
          return new AssistedTextAnnotation(a.rawData, updatedAt);
        }
        if (a.type === 'tldraw') {
          return new TldrawBoardAnnotation(a.rawData, a.svgPreview, updatedAt);
        }
        return new DrawioDiagramAnnotation(a.rawData, a.svgPreview, updatedAt);
      });

      return new Highlight(
        h.id,
        h.bookHash,
        h.text,
        h.color,
        h.anchor,
        h.note,
        new Date(h.createdAt),
        new Date(h.updatedAt),
        annotations
      );
    });

    const binaries = parsed.binaries
      ? new Map<string, ArrayBuffer>(
          Object.entries(parsed.binaries).map(([hash, bytes]) => [
            hash,
            new Uint8Array(bytes).buffer,
          ])
        )
      : undefined;

    return {
      schemaVersion: parsed.schemaVersion,
      exportedAt: new Date(parsed.exportedAt),
      deviceId: parsed.deviceId,
      books,
      highlights,
      deletedIds: parsed.deletedIds,
      binaries,
    };
  }
}
