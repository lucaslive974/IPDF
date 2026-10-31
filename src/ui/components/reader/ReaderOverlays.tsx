import { memo } from 'react';
import { useReader } from '../../hooks/useReader';
import { useReaderUI } from '../../hooks/useReaderUI';
import { useTypographyStore } from '../../stores/useTypographyStore';
import { ExplainDialog } from '../ExplainDialog';
import { HighlightDetailModal } from '../HighlightDetailModal';
import { HighlightPopover } from '../HighlightPopover';
import { NoteDialog } from '../NoteDialog';
import { ReaderContextMenu } from '../ReaderContextMenu';
import { TranslateDialog } from '../TranslateDialog';
import { ReaderAppearancePopover } from './ReaderAppearancePopover';

export const ReaderOverlays = memo(function ReaderOverlays() {
  const reader = useReader();
  const {
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

  const popoverX = typeof window !== 'undefined' ? Math.max(160, window.innerWidth - 170) : 800;

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
            void reader.createHighlightWithColor(
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
            void reader.createHighlightWithColor(
              color,
              activeNoteDialog.text,
              note,
              activeNoteDialog.pageNumber
            );
            setActiveNoteDialog(null);
          }}
          onOpenStudio={() => {
            void reader
              .createHighlightWithColor(
                '#d97706',
                activeNoteDialog.text,
                '',
                activeNoteDialog.pageNumber
              )
              .then((hl) => {
                if (hl) reader.openExpandedStudio(hl);
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
          bookTitle={`${reader.document.bookTitle} (${reader.document.chapterTitle})`}
          onSaveAsAnnotation={(explanation) => {
            void reader.createHighlightWithColor(
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
            void reader.createHighlightWithColor(
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
      {reader.activeHighlightPopover && (
        <HighlightPopover
          highlight={reader.activeHighlightPopover.highlight}
          x={reader.activeHighlightPopover.x}
          y={reader.activeHighlightPopover.y}
          noteDraft={reader.noteInput}
          onNoteChange={reader.updateNoteDraft}
          onChangeColor={(color) =>
            void reader.changeHighlightColor(
              reader.activeHighlightPopover?.highlight.id ?? '',
              color
            )
          }
          onDelete={() =>
            void reader.deleteHighlight(reader.activeHighlightPopover?.highlight.id ?? '')
          }
          onExpand={() => {
            if (reader.activeHighlightPopover) {
              reader.openExpandedStudio(reader.activeHighlightPopover.highlight);
            }
          }}
          onClose={reader.closeHighlightPopover}
        />
      )}

      {/* 6. Dedicated Expanded Studio Modal */}
      {reader.expandedHighlight && (
        <HighlightDetailModal
          highlight={reader.expandedHighlight}
          noteInput={reader.noteInput}
          formattedAnnotations={reader.formattedAnnotations}
          llmPromptPreview={reader.llmPromptPreview}
          onNoteChange={reader.updateNoteDraft}
          onSelectionChange={reader.updateSelectionRange}
          onApplyFormat={(style) => void reader.applyAssistedFormat(style)}
          onAttachBoard={(kind) => void reader.attachVisualBoard(kind)}
          onGeneratePrompt={() => void reader.generateContextualPrompt()}
          onClose={reader.closeExpandedStudio}
        />
      )}
    </>
  );
});
