import { useState } from 'react';
import { Badge, Button, Dialog } from './ui';

export interface TranslateDialogProps {
  readonly isOpen: boolean;
  readonly text: string;
  readonly onSaveAsNote: (translation: string) => void;
  readonly onClose: () => void;
}

interface TargetLanguage {
  readonly code: string;
  readonly label: string;
  readonly flag: string;
}

const LANGUAGES: readonly TargetLanguage[] = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'es', label: 'Espanhol', flag: '🇪🇸' },
  { code: 'fr', label: 'Francês', flag: '🇫🇷' },
  { code: 'de', label: 'Alemão', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
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
      title="Traduzir Trecho"
      subtitle="Tradução contextual assistida com preservação de termos acadêmicos."
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="secondary" size="sm" iconLeft={copied ? '✓' : '📋'} onClick={handleCopy}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button variant="primary" size="sm" iconLeft="💾" onClick={handleSave}>
            Salvar como Nota
          </Button>
        </>
      }
    >
      {/* Original Passage */}
      <div className="rounded-xl border border-line-subtle bg-surface-subtle/70 p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold text-tx-muted uppercase tracking-wider">
            Original (Inglês)
          </span>
          <Badge variant="neutral" size="xs">
            EN
          </Badge>
        </div>
        <p className="text-xs text-tx-main italic leading-relaxed border-l-2 border-line-strong pl-2.5">
          &ldquo;{text}&rdquo;
        </p>
      </div>

      {/* Language Selector */}
      <div className="space-y-1.5">
        <span className="text-[0.7rem] font-semibold text-tx-secondary block">
          Idioma de Destino:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setTargetLang(lang.code)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
                targetLang === lang.code
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-surface-subtle text-tx-muted hover:text-tx-main hover:bg-surface-hover'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Translation Result */}
      <div className="rounded-xl border border-line-subtle bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-tx-main">Tradução Contextual</span>
          <Badge variant="brand" size="xs">
            {targetLang.toUpperCase()}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-tx-main text-justify font-serif">
          {translation}
        </p>

        {notes && (
          <div className="rounded-lg bg-surface-subtle/80 p-2 text-[0.7rem] text-tx-muted border-l-2 border-brand">
            <span className="font-semibold text-tx-secondary">Nota terminológica: </span>
            {notes}
          </div>
        )}
      </div>
    </Dialog>
  );
}
