import type { BookFormat } from '../domain/types';
import type { IDocumentViewer } from './IDocumentViewer';

export interface IDocumentViewerFactory {
  getViewer(format: BookFormat): IDocumentViewer;
}
