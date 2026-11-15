import type { BookFormat } from './types';

export interface BookMetadata {
  bookHash: string;
  title: string;
  author: string;
  format: BookFormat;
  currentPage: number;
  totalPages: number;
  percentage: number;
  pageOffsetRatio?: number;
  description?: string;
  tags: string[];
  lastReadAt: Date;
  updatedAt: Date;
}
