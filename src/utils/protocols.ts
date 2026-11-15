import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Builds the native `cover://` protocol URL for a given book hash.
 * Appends an optional cache-busting version query parameter when provided.
 */
export function buildCoverProtocolUrl(bookHash: string, version?: number): string {
  const baseUrl =
    typeof window !== 'undefined'
      ? convertFileSrc(bookHash, 'cover')
      : `cover://localhost/${encodeURIComponent(bookHash)}`;
  return version !== undefined ? `${baseUrl}?v=${version}` : baseUrl;
}
