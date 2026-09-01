import { useRef, type KeyboardEvent, type UIEvent } from "react";

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  readOnly?: boolean;
  highlightLine?: number;
  language?: string;
};

function highlightedCode(value: string) {
  const tokens = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:export|interface|type|import|from|class|const|return|def|pass|as)\b|\b(?:true|false|null|True|False|None)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b[A-Za-z_$][\w$]*(?=\??\s*:)/g;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(value))) {
    if (match.index > cursor) pieces.push(value.slice(cursor, match.index));
    const token = match[0];
    let kind = "token-property";
    if (/^["']/.test(token)) kind = value.slice(tokens.lastIndex).match(/^\s*:/) ? "token-property" : "token-string";
    else if (/^(true|false|null|True|False|None)$/.test(token)) kind = "token-boolean";
    else if (/^-?\d/.test(token)) kind = "token-number";
    else if (/^(export|interface|type|import|from|class|const|return|def|pass|as)$/.test(token)) kind = "token-keyword";
    pieces.push(<span className={kind} key={`${match.index}-${token}`}>{token}</span>);
    cursor = tokens.lastIndex;
  }
  pieces.push(value.slice(cursor));
  return pieces;
}

export function CodeEditor({ value, onChange, label, readOnly = false, highlightLine, language = "json" }: CodeEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = event.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey || readOnly || !onChange) return;
    event.preventDefault();
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textRef.current?.setSelectionRange(start + 2, start + 2);
    });
  }

  return (
    <div className="code-editor" data-language={language}>
      <div className="line-gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <div className={highlightLine === index + 1 ? "line-number line-number-error" : "line-number"} key={index}>{index + 1}</div>
        ))}
      </div>
      <pre className="code-highlight" ref={highlightRef} aria-hidden="true"><code>{highlightedCode(value)}{"\n"}</code></pre>
      <textarea
        ref={textRef}
        className="code-input"
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
      />
    </div>
  );
}