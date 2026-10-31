import { useState } from 'react';
import {
  Badge,
  Button,
  CopyIcon,
  Dialog,
  PassageQuote,
  SegmentedControl,
  SparklesIcon,
} from './ui';

export interface ExplainDialogProps {
  readonly isOpen: boolean;
  readonly text: string;
  readonly bookTitle?: string;
  readonly onSaveAsAnnotation: (explanation: string) => void;
  readonly onClose: () => void;
}

type ExplainMode = 'concepts' | 'historical' | 'simple' | 'deep';

interface ModeOption {
  readonly id: ExplainMode;
  readonly label: string;
}

const MODES: readonly ModeOption[] = [
  { id: 'concepts', label: 'Key Concepts' },
  { id: 'historical', label: 'Historical' },
  { id: 'simple', label: 'Simplified' },
  { id: 'deep', label: 'In-Depth' },
];

export function ExplainDialog({
  isOpen,
  text,
  bookTitle = 'Selected Book',
  onSaveAsAnnotation,
  onClose,
}: ExplainDialogProps) {
  const [currentMode, setCurrentMode] = useState<ExplainMode>('concepts');
  const [copied, setCopied] = useState<boolean>(false);

  const getExplanationContent = (mode: ExplainMode, _excerpt: string): string => {
    switch (mode) {
      case 'concepts':
        return 'The passage explores the fundamental tension between sensory perception (doxa) and intelligible knowledge (noesis). The allegory exposes how the chains of ignorance habituate consciousness to mere shadows of reality, suggesting that the apprehension of truth demands a deliberate conversion of the soul toward the light.';
      case 'historical':
        return 'In 4th-century BCE classical Greece, Plato confronted the relativism of the Sophists. This passage reflects the concern for the ethical and political education of Athenian citizens, utilizing the allegory of the cave to demonstrate the necessity of paideia (transformative learning).';
      case 'simple':
        return 'In direct terms: human beings are confined and believe the shadows on the wall are the entirety of reality, having never known anything else. To discover truth, one must break free and look directly at the actual source of light.';
      case 'deep':
        return 'Epistemologically, the excerpt marks the ascending degrees of the Divided Line: from eikasia (conjecture) to noesis (pure intellectual intuition). The metaphor of chains operates as an ontological critique of human existence separated from the Idea of the Good.';
    }
  };

  const currentExplanation = getExplanationContent(currentMode, text);

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(currentExplanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    onSaveAsAnnotation(currentExplanation);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Explain Passage"
      subtitle={`Contextual analysis — ${bookTitle}`}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<CopyIcon className="h-3.5 w-3.5" />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save Annotation
          </Button>
        </>
      }
    >
      <PassageQuote text={text} />

      <SegmentedControl
        options={MODES}
        value={currentMode}
        onChange={setCurrentMode}
        className="w-full flex"
      />

      {/* AI Explanation Result Box */}
      <div className="rounded-lg border border-line-subtle/80 bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-tx-main">
            <SparklesIcon className="h-3.5 w-3.5 text-tx-muted" />
            <span>Analytical Synthesis</span>
          </div>
          <Badge variant="neutral" size="xs">
            Assistant
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-tx-secondary text-justify">
          {currentExplanation}
        </p>
      </div>
    </Dialog>
  );
}
