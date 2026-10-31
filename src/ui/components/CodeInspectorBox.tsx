export interface CodeInspectorBoxProps {
  readonly title: string;
  readonly codeSymbol?: string;
  readonly content: string;
}

export function CodeInspectorBox({ title, codeSymbol, content }: CodeInspectorBoxProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <strong className="text-xs font-semibold text-slate-300">
        {title}
        {codeSymbol ? (
          <>
            {' '}
            (<code className="font-mono text-sky-400">{codeSymbol}</code>)
          </>
        ) : null}
        :
      </strong>
      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
        {content}
      </pre>
    </div>
  );
}
