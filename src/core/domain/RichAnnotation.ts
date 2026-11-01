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
): AssistedTextAnnotationData {
  return {
    type: 'assisted-markdown',
    rawData,
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
