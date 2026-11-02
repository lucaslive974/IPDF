import type { BookFormat } from './types';

export interface BookMetadata {
  bookHash: string;
  title: string;
  author: string;
  format: BookFormat;
  currentPage: number;
  totalPages: number;
  percentage: number;
  coverImageBuffer?: Uint8Array;
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string;
  description?: string;
  tags: string[];
  lastReadAt: Date;
  updatedAt: Date;
}
