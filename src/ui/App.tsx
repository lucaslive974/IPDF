import { PassageReaderPanel } from './components/PassageReaderPanel';
import { SectionAnnotationPanel } from './components/SectionAnnotationPanel';
import { useStudyWorkbenchViewModel } from './hooks/useStudyWorkbenchViewModel';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';

function StudyWorkbenchView() {
  const vm = useStudyWorkbenchViewModel();

  return (
    <div className="app-layout">
      <PassageReaderPanel
        document={vm.document}
        highlights={vm.highlights}
        selectedHighlightId={vm.selectedId}
        onCreateHighlight={(color) => void vm.createHighlightFromCurrentSelection(color)}
        onSelectHighlight={(id) => void vm.selectHighlight(id)}
        onGeneratePrompt={vm.generateContextualPrompt}
        onSyncBook={() => void vm.runCloudlessSync()}
      />

      <SectionAnnotationPanel
        noteInput={vm.noteInput}
        visitorOutput={vm.visitorOutput}
        llmPromptPreview={vm.llmPromptPreview}
        syncExportPreview={vm.syncExportPreview}
        onNoteChange={vm.updateNoteDraft}
        onSelectionChange={vm.updateSelectionRange}
        onApplyFormat={(style) => void vm.applyAssistedFormat(style)}
        onAttachBoard={(kind) => void vm.attachVisualBoard(kind)}
      />
    </div>
  );
}

export function App() {
  return (
    <ServiceContainerProvider>
      <StudyWorkbenchView />
    </ServiceContainerProvider>
  );
}
