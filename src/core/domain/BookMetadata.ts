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
