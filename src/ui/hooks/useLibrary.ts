import { type LibraryContextValue, useLibraryContext } from '../providers/LibraryContext';

export type { LibraryContextValue };

export function useLibrary(): LibraryContextValue {
  return useLibraryContext();
}
