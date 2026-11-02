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
    if (annotation.type === 'assisted-markdown') {
      this.note = annotation.rawData.trim();
    }
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

  public formatAnnotations<R>(formatterMap: AnnotationFormatterMap<R>): R[] {
    return this.getAllRichAnnotations().map((annotation) =>
      formatRichAnnotation(annotation, formatterMap)
    );
  }

  public overlapsWith(otherAnchor: HighlightAnchor): boolean {
    if (
      this.anchor.format !== otherAnchor.format ||
      this.anchor.pageNumber !== otherAnchor.pageNumber
    ) {
      return false;
    }
    if (this.anchor.format === BookFormat.EPUB) {
      return Boolean(this.anchor.epubCfi && this.anchor.epubCfi === otherAnchor.epubCfi);
    }
    if (this.anchor.format === BookFormat.PDF && this.anchor.pdfRects && otherAnchor.pdfRects) {
      const otherRects = otherAnchor.pdfRects;
      return this.anchor.pdfRects.some((r1) =>
        otherRects.some(
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
