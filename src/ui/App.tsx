import { PassageReaderPanel } from './components/PassageReaderPanel';
import { SectionAnnotationPanel } from './components/SectionAnnotationPanel';
import { useStudyWorkbenchViewModel } from './hooks/useStudyWorkbenchViewModel';
import { ServiceContainerProvider } from './providers/ServiceContainerContext';

function StudyWorkbenchView() {
  const vm = useStudyWorkbenchViewModel();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-5">
      <div className="mx-auto max-w-360 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <PassageReaderPanel
          document={vm.document}
          highlights={vm.highlights}
          selectedHighlightId={vm.selectedId}
          onCreateHighlight={(color) => void vm.createHighlightFromCurrentSelection(color)}
          onSelectHighlight={(id) => void vm.selectHighlight(id)}
          onGeneratePrompt={() => void vm.generateContextualPrompt()}
          onSyncBook={() => void vm.runCloudlessSync()}
        />

        <SectionAnnotationPanel
          noteInput={vm.noteInput}
          formattedAnnotations={vm.formattedAnnotations}
          llmPromptPreview={vm.llmPromptPreview}
          syncExportPreview={vm.syncExportPreview}
          onNoteChange={vm.updateNoteDraft}
          onSelectionChange={vm.updateSelectionRange}
          onApplyFormat={(style) => void vm.applyAssistedFormat(style)}
          onAttachBoard={(kind) => void vm.attachVisualBoard(kind)}
        />
      </div>
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
