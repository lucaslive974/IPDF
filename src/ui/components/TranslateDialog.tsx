import { useState } from 'react';
import { Badge, Button, CopyIcon, Dialog, PassageQuote, SegmentedControl } from './ui';

export interface TranslateDialogProps {
  readonly isOpen: boolean;
  readonly text: string;
  readonly onSaveAsNote: (translation: string) => void;
  readonly onClose: () => void;
}

interface TargetLanguage {
  readonly code: string;
  readonly label: string;
}

const LANGUAGES: readonly TargetLanguage[] = [
  { code: 'pt', label: 'Portuguese' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
];

export function TranslateDialog({ isOpen, text, onSaveAsNote, onClose }: TranslateDialogProps) {
  const [targetLang, setTargetLang] = useState<string>('pt');
  const [copied, setCopied] = useState<boolean>(false);

  const getTranslation = (
    langCode: string,
    original: string
  ): { translation: string; notes?: string } => {
    switch (langCode) {
      case 'pt':
        return {
          translation:
            'Eis seres humanos vivendo em uma morada subterrânea em forma de caverna, cuja entrada se abre amplamente para a luz por toda a extensão; ali eles habitam desde a infância, com as pernas e os pescoços acorrentados de tal modo que permanecem imóveis e só conseguem enxergar à sua frente.',
          notes:
            '“noesis vs. doxa” traduz-se tecnicamente por “conhecimento inteligível vs. opinião sensorial”.',
        };
      case 'es':
        return {
          translation:
            'He aquí a seres humanos viviendo en una morada subterránea en forma de caverna, que tiene su entrada abierta a la luz en toda su extensión; allí permanecen desde niños, con las piernas y el cuello encadenados.',
          notes: '“noesis vs. doxa” corresponde a “intelección pura frente a opinión sensible”.',
        };
      case 'fr':
        return {
          translation:
            'Voici des êtres humains vivant dans une demeure souterraine semblable à une caverne, dont l’ouverture s’étend largement vers la lumière sur toute sa longueur; ils y sont depuis l’enfance, les jambes et le cou enchaînés.',
          notes: '“noesis vs. doxa” est rendu par “intelligence intelligible vs opinion sensible”.',
        };
      case 'de':
        return {
          translation:
            'Siehe, Menschen leben in einer unterirdischen höhlenartigen Behausung, die einen nach dem Lichte zu offenen Eingang in ihrer ganzen Ausdehnung hat; dort verweilen sie von Kindheit an, an Schenkeln und Nacken gefesselt.',
          notes:
            '“noesis vs. doxa” entspricht der Unterscheidung zwischen geistiger Einsicht und Sinnesmeinung.',
        };
      case 'it':
        return {
          translation:
            'Ecco degli esseri umani che vivono in una dimora sotterranea a forma di caverna, con l’apertura che si volge alla luce lungo tutta la sua estensione; qui essi sono fin dall’infanzia, con gambe e collo incatenati.',
          notes:
            '“noesis vs. doxa” indica la pura conoscenza intelligibile rispetto all’opinione sensibile.',
        };
      default:
        return {
          translation: original,
        };
    }
  };

  const { translation, notes } = getTranslation(targetLang, text);

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    onSaveAsNote(translation);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Translate Passage"
      subtitle="Contextual translation preserving philosophical and academic terms."
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
            Save Note
          </Button>
        </>
      }
    >
      <PassageQuote text={text} />

      <div className="space-y-1.5">
        <span className="text-[0.68rem] font-medium text-tx-secondary block">Target Language:</span>
        <SegmentedControl
          options={LANGUAGES.map((l) => ({ id: l.code, label: l.label }))}
          value={targetLang}
          onChange={setTargetLang}
          className="w-full flex"
        />
      </div>

      {/* Translation Result Box */}
      <div className="rounded-lg border border-line-subtle/80 bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-tx-main">Contextual Translation</span>
          <Badge variant="neutral" size="xs">
            {targetLang.toUpperCase()}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-tx-secondary text-justify">{translation}</p>

        {notes && (
          <div className="border-t border-line-subtle/50 pt-2 text-[0.68rem] text-tx-muted italic">
            {notes}
          </div>
        )}
      </div>
    </Dialog>
  );
}
