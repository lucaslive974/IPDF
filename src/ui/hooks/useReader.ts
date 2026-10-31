import { type ReaderContextValue, useReaderContext } from '../providers/ReaderContext';

export function useReader(): ReaderContextValue {
  return useReaderContext();
}
