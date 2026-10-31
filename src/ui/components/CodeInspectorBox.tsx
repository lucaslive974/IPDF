export interface CodeInspectorBoxProps {
  readonly title: string;
  readonly codeSymbol?: string;
  readonly content: string;
}

export function CodeInspectorBox({ title, codeSymbol, content }: CodeInspectorBoxProps) {
  return (
    <div>
      <strong>
        {title}
        {codeSymbol ? (
          <>
            {' '}
            (<code>{codeSymbol}</code>)
          </>
        ) : null}
        :
      </strong>
      <pre className="code-box">{content}</pre>
    </div>
  );
}
