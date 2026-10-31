import { type LibraryContextValue, useLibraryContext } from '../providers/LibraryContext';

export function useLibrary(): LibraryContextValue {
  return useLibraryContext();
}
