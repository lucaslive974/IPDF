import type { BookFormat } from './types';

export interface BookMetadata {
  bookHash: string; // SHA-256 do binário
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
  coverImageUrl?: string; // URL pública resolvida (para Discord RPC)
  lastReadAt: Date;
  updatedAt: Date;
}
