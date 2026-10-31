export interface CodeInspectorBoxProps {
  readonly title: string;
  readonly codeSymbol?: string;
  readonly content: string;
}

export function CodeInspectorBox({ title, codeSymbol, content }: CodeInspectorBoxProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <strong className="text-xs font-medium text-tx-secondary">
        {title}
        {codeSymbol ? (
          <>
            {' '}
            (<code className="font-mono text-tx-main">{codeSymbol}</code>)
          </>
        ) : null}
        :
      </strong>
      <pre className="overflow-x-auto rounded-lg border border-line-subtle bg-surface-subtle p-3 font-mono text-xs text-tx-main">
        {content}
      </pre>
    </div>
  );
}
