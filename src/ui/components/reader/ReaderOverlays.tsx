import { useReaderNotesEditor } from '@hooks/useReaderNotesEditor';
import { useReaderTextSelection } from '@hooks/useReaderTextSelection';
import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { getViewportWidth } from '@utils/dom';
import { memo } from 'react';
import { ExplainDialog } from '../ExplainDialog';
import { HighlightDetailModal } from '../HighlightDetailModal';
import { HighlightPopover } from '../HighlightPopover';
import { NoteDialog } from '../NoteDialog';
import { ReaderContextMenu } from '../ReaderContextMenu';
import { TranslateDialog } from '../TranslateDialog';
import { ReaderAppearancePopover } from './ReaderAppearancePopover';

export const ReaderOverlays = memo(function ReaderOverlays() {
  const document = useReaderStore((s) => s.document);
  const { createHighlightWithColor } = useReaderTextSelection();
  const notes = useReaderNotesEditor();
  const {
    activeHighlightPopover,
    expandedHighlight,
    openExpandedStudio,
    closeHighlightPopover,
    closeExpandedStudio,
    changeHighlightColor,
    deleteHighlight,
    contextMenu,
    activeNoteDialog,
    activeExplainDialog,
    activeTranslateDialog,
    setContextMenu,
    setActiveNoteDialog,
    setActiveExplainDialog,
    setActiveTranslateDialog,
  } = useReaderUI();

  const isAppearancePopoverOpen = useTypographyStore((s) => s.isAppearancePopoverOpen);
  const setAppearancePopoverOpen = useTypographyStore((s) => s.setAppearancePopoverOpen);

  const popoverX = Math.max(160, getViewportWidth(970) - 170);

  return (
    <>
      {/* 0. Apple Books Style Appearance & Typography Popover */}
      {isAppearancePopoverOpen && (
        <ReaderAppearancePopover
          x={popoverX}
          y={60}
          onClose={() => setAppearancePopoverOpen(false)}
        />
      )}

      {/* 1. Right-Click Context Menu (Dropdown) */}
      {contextMenu && (
        <ReaderContextMenu
          text={contextMenu.text}
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={true}
          onHighlightColor={(color) => {
            void createHighlightWithColor(
              color,
              contextMenu.text,
              undefined,
              contextMenu.pageNumber
            );
          }}
          onOpenNoteDialog={() => {
            setActiveNoteDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onOpenExplainDialog={() => {
            setActiveExplainDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onOpenTranslateDialog={() => {
            setActiveTranslateDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onCopyText={() => {
            if (typeof navigator !== 'undefined') {
              void navigator.clipboard.writeText(contextMenu.text);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 2. Note Creation Dialog */}
      {activeNoteDialog && (
        <NoteDialog
          isOpen={true}
          text={activeNoteDialog.text}
          onSave={(color, note) => {
            void createHighlightWithColor(
              color,
              activeNoteDialog.text,
              note,
              activeNoteDialog.pageNumber
            );
            setActiveNoteDialog(null);
          }}
          onOpenStudio={() => {
            void createHighlightWithColor(
              '#d97706',
              activeNoteDialog.text,
              '',
              activeNoteDialog.pageNumber
            ).then((hl) => {
              if (hl) openExpandedStudio(hl);
            });
            setActiveNoteDialog(null);
          }}
          onClose={() => setActiveNoteDialog(null)}
        />
      )}

      {/* 3. AI Explanation Dialog */}
      {activeExplainDialog && (
        <ExplainDialog
          isOpen={true}
          text={activeExplainDialog.text}
          bookTitle={`${document.bookTitle} (${document.chapterTitle})`}
          onSaveAsAnnotation={(explanation) => {
            void createHighlightWithColor(
              '#7c3aed',
              activeExplainDialog.text,
              `[IA Explanation]: ${explanation}`,
              activeExplainDialog.pageNumber
            );
            setActiveExplainDialog(null);
          }}
          onClose={() => setActiveExplainDialog(null)}
        />
      )}

      {/* 4. Translation Dialog */}
      {activeTranslateDialog && (
        <TranslateDialog
          isOpen={true}
          text={activeTranslateDialog.text}
          onSaveAsNote={(translation) => {
            void createHighlightWithColor(
              '#0284c7',
              activeTranslateDialog.text,
              `[Tradução]: ${translation}`,
              activeTranslateDialog.pageNumber
            );
            setActiveTranslateDialog(null);
          }}
          onClose={() => setActiveTranslateDialog(null)}
        />
      )}

      {/* 5. Floating Highlight Quick Popover */}
      {activeHighlightPopover && (
        <HighlightPopover
          highlight={activeHighlightPopover.highlight}
          x={activeHighlightPopover.x}
          y={activeHighlightPopover.y}
          noteDraft={notes.noteInput}
          onNoteChange={notes.updateNoteDraft}
          onChangeColor={(color) =>
            void changeHighlightColor(activeHighlightPopover?.highlight.id ?? '', color)
          }
          onDelete={() => void deleteHighlight(activeHighlightPopover?.highlight.id ?? '')}
          onExpand={() => {
            if (activeHighlightPopover) {
              openExpandedStudio(activeHighlightPopover.highlight);
            }
          }}
          onClose={closeHighlightPopover}
        />
      )}

      {/* 6. Dedicated Expanded Studio Modal */}
      {expandedHighlight && (
        <HighlightDetailModal
          highlight={expandedHighlight}
          noteInput={notes.noteInput}
          llmPromptPreview={notes.llmPromptPreview}
          onNoteChange={notes.updateNoteDraft}
          onSelectionChange={notes.updateSelectionRange}
          onApplyFormat={(style) => void notes.applyAssistedFormat(style)}
          onGeneratePrompt={() => void notes.generateContextualPrompt()}
          onClose={closeExpandedStudio}
        />
      )}
    </>
  );
});
