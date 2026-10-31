import { useState } from 'react';
import { Badge, Button, Dialog } from './ui';

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
  readonly icon: string;
}

const MODES: readonly ModeOption[] = [
  { id: 'concepts', label: 'Conceitos-Chave', icon: '🧠' },
  { id: 'historical', label: 'Histórico-Cultural', icon: '🏛️' },
  { id: 'simple', label: 'Simplificar', icon: '💡' },
  { id: 'deep', label: 'Aprofundamento', icon: '🔍' },
];

export function ExplainDialog({
  isOpen,
  text,
  bookTitle = 'Livro em Estudo',
  onSaveAsAnnotation,
  onClose,
}: ExplainDialogProps) {
  const [currentMode, setCurrentMode] = useState<ExplainMode>('concepts');
  const [copied, setCopied] = useState<boolean>(false);

  const getExplanationContent = (mode: ExplainMode, _excerpt: string): string => {
    switch (mode) {
      case 'concepts':
        return 'O trecho aborda a tensão fundamental entre a percepção sensorial (doxa) e o conhecimento inteligível (noesis). A alegoria expõe como as correntes da ignorância habituam a consciência às sombras da realidade, sugerindo que a apreensão da verdade exige uma conversão deliberada da alma em direção à luz.';
      case 'historical':
        return 'Na Grécia clássica do século IV a.C., Platão confrontava o relativismo dos sofistas. Este trecho reflete a preocupação com a formação ética e política dos cidadãos atenienses, utilizando o mito da caverna para ilustrar a necessidade da paideia (educação transformadora).';
      case 'simple':
        return 'Em termos diretos: as pessoas estão presas e acreditam que as sombras na parede são a realidade inteira, porque nunca viram nada diferente. Para conhecer a verdade, é preciso se libertar e olhar para a fonte real da luz.';
      case 'deep':
        return 'Epistemologicamente, o excerto estabelece os graus da Linha Dividida: da eikasia (conjectura) à noesis (intuição intelectual). A metáfora das correntes e da caverna opera como uma crítica ontológica à condição humana desacoplada da Ideia do Bem.';
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
      title="Explicar com IA"
      subtitle={`Análise hermenêutica contextual — ${bookTitle}`}
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
            Salvar Anotação
          </Button>
        </>
      }
    >
      {/* Excerpt */}
      <div className="rounded-xl border border-line-subtle bg-surface-subtle/70 p-3 space-y-1">
        <span className="text-[0.65rem] font-semibold text-tx-muted uppercase tracking-wider">
          Trecho Analisado
        </span>
        <p className="text-xs text-tx-main italic leading-relaxed border-l-2 border-line-strong pl-2.5">
          &ldquo;{text}&rdquo;
        </p>
      </div>

      {/* Perspective / Modes */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setCurrentMode(mode.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
              currentMode === mode.id
                ? 'bg-brand text-white shadow-xs'
                : 'bg-surface-subtle text-tx-muted hover:text-tx-main hover:bg-surface-hover'
            }`}
          >
            <span>{mode.icon}</span>
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      {/* AI Explanation Result Box */}
      <div className="rounded-xl border border-line-subtle bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <span className="text-xs font-semibold text-tx-main">Síntese Analítica</span>
          </div>
          <Badge variant="brand" size="xs">
            IA Assistant
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-tx-secondary text-justify">
          {currentExplanation}
        </p>
      </div>
    </Dialog>
  );
}
