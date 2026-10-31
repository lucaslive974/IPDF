import type { RichAnnotationType } from './types';

export interface AssistedTextAnnotationData {
  readonly type: 'assisted-markdown';
  readonly rawData: string;
  readonly svgPreview?: undefined;
  readonly updatedAt: Date;
}

export interface TldrawBoardAnnotationData {
  readonly type: 'tldraw';
  readonly rawData: string;
  readonly svgPreview?: string;
  readonly updatedAt: Date;
}

export interface DrawioDiagramAnnotationData {
  readonly type: 'drawio';
  readonly rawData: string;
  readonly svgPreview?: string;
  readonly updatedAt: Date;
}

export type IRichAnnotation =
  | AssistedTextAnnotationData
  | TldrawBoardAnnotationData
  | DrawioDiagramAnnotationData;

export function createAssistedTextAnnotation(
  rawData: string,
  updatedAt: Date = new Date()
): AssistedTextAnnotationData {
  return {
    type: 'assisted-markdown',
    rawData,
    updatedAt,
  };
}

export function createTldrawBoardAnnotation(
  rawData: string,
  svgPreview?: string,
  updatedAt: Date = new Date()
): TldrawBoardAnnotationData {
  return {
    type: 'tldraw',
    rawData,
    svgPreview,
    updatedAt,
  };
}

export function createDrawioDiagramAnnotation(
  rawData: string,
  svgPreview?: string,
  updatedAt: Date = new Date()
): DrawioDiagramAnnotationData {
  return {
    type: 'drawio',
    rawData,
    svgPreview,
    updatedAt,
  };
}

export type AnnotationFormatterMap<R> = {
  readonly [K in RichAnnotationType]: (annotation: Extract<IRichAnnotation, { type: K }>) => R;
};

export function formatRichAnnotation<R>(
  annotation: IRichAnnotation,
  formatterMap: AnnotationFormatterMap<R>
): R {
  const formatter = formatterMap[annotation.type] as (ann: IRichAnnotation) => R;
  return formatter(annotation);
}
