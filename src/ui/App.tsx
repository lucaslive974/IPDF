import { HighlightDetailModal } from './components/HighlightDetailModal';
import { LibraryView } from './components/LibraryView';
import { ReaderView } from './components/ReaderView';
import { SettingsView } from './components/SettingsView';
import { useStudyWorkbenchViewModel } from './hooks/useStudyWorkbenchViewModel';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';
import { ThemeProvider } from './providers/ThemeContext';

function StudyWorkbenchView() {
  const vm = useStudyWorkbenchViewModel();

  return (
    <>
      {vm.currentView === 'library' && (
        <LibraryView
          books={vm.libraryBooks}
          highlights={vm.highlights}
          onOpenBook={(book) => vm.openReader(book)}
          onImportNewBook={() => void vm.importSampleEpubBook()}
          onOpenSettings={() => vm.openSettings()}
        />
      )}

      {vm.currentView === 'reader' && (
        <ReaderView
          document={vm.document}
          currentPage={vm.currentPage}
          totalPages={vm.totalPages}
          highlights={vm.highlights}
          selectionPopover={vm.selectionPopover}
          activeHighlightPopover={vm.activeHighlightPopover}
          noteDraft={vm.noteInput}
          onBackToLibrary={() => vm.closeReader()}
          onOpenSettings={() => vm.openSettings()}
          onNavigatePage={(delta) => void vm.navigatePage(delta)}
          onSelectText={(state) => vm.setSelectionPopover(state)}
          onHighlightClick={(highlight, coords) => vm.openHighlightPopover(highlight, coords)}
          onCloseHighlightPopover={() => vm.closeHighlightPopover()}
          onCreateHighlight={(colorHex) => void vm.createHighlightWithColor(colorHex)}
          onChangeHighlightColor={(id, colorHex) => void vm.changeHighlightColor(id, colorHex)}
          onDeleteHighlight={(id) => void vm.deleteHighlight(id)}
          onNoteChange={vm.updateNoteDraft}
          onExpandHighlight={() => {
            if (vm.activeHighlightPopover) {
              vm.openExpandedHighlightStudio(vm.activeHighlightPopover.highlight);
            }
          }}
          onExplainSelection={() => void vm.generateContextualPrompt()}
          onDefineSelection={() => void vm.generateContextualPrompt('Define philosophical concept')}
          onTranslateSelection={() =>
            void vm.generateContextualPrompt('Translate passage into Portuguese')
          }
        />
      )}

      {vm.currentView === 'settings' && (
        <SettingsView
          syncExportPreview={vm.syncExportPreview}
          onRunCloudlessSync={() => void vm.runCloudlessSync()}
          onBackToLibrary={() => vm.closeSettings()}
        />
      )}

      {vm.expandedHighlight && (
        <HighlightDetailModal
          highlight={vm.expandedHighlight}
          noteInput={vm.noteInput}
          formattedAnnotations={vm.formattedAnnotations}
          llmPromptPreview={vm.llmPromptPreview}
          onNoteChange={vm.updateNoteDraft}
          onSelectionChange={vm.updateSelectionRange}
          onApplyFormat={(style) => void vm.applyAssistedFormat(style)}
          onAttachBoard={(kind) => void vm.attachVisualBoard(kind)}
          onGeneratePrompt={() => void vm.generateContextualPrompt()}
          onClose={() => vm.closeExpandedHighlightStudio()}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ServiceContainerProvider>
        <StudyWorkbenchView />
      </ServiceContainerProvider>
    </ThemeProvider>
  );
}
