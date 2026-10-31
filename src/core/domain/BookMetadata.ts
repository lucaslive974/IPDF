import type { BookFormat } from './types';

export type BookSourceType = 'standalone-file' | 'local-folder' | 'remote-storage';

export interface BookMetadata {
  bookHash: string;
  title: string;
  author: string;
  format: BookFormat;
  currentPage: number;
  totalPages: number;
  percentage: number;
  sourceType?: BookSourceType;
  localFilePath?: string;
  isDownloadedLocally: boolean;
  remoteFileId?: string;
  coverImageBuffer?: Uint8Array;
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string;
  lastReadAt: Date;
  updatedAt: Date;
}
