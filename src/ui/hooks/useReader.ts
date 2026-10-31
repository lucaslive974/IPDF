import {
  type ActiveHighlightPopoverState,
  type ReaderContextValue,
  type SelectionPopoverState,
  type StudyDocumentDescriptor,
  useReaderContext,
} from '../providers/ReaderContext';

export type {
  ReaderContextValue,
  StudyDocumentDescriptor,
  SelectionPopoverState,
  ActiveHighlightPopoverState,
};

export function useReader(): ReaderContextValue {
  return useReaderContext();
}
