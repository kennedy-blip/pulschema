import { Check, CheckCircle2, Copy, FileCode2, FileJson2, WandSparkles, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CodeEditor } from "./CodeEditor";

export type Notify = (message: string, type?: "success" | "error") => void;

export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-kicker"><span /> YOUR DEVELOPER WORKSPACE</div>
        <h1>{title}<span className="title-period">.</span></h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function WorkspaceLabel({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="workspace-label"><span><span className="label-square" />{title}</span><div>{right}</div></div>;
}

type EditorPanelProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent?: "violet" | "emerald" | "blue" | "amber";
  fileName: string;
  value: string;
  onChange?: (value: string) => void;
  onCopy: () => void;
  onFormat?: () => void;
  readOnly?: boolean;
  headerAside?: ReactNode;
  footer?: string;
  footerState?: "success" | "error" | "neutral";
  highlightLine?: number;
  language?: string;
  className?: string;
};

export function EditorPanel({ title, subtitle, icon: Icon, accent = "violet", fileName, value, onChange, onCopy, onFormat, readOnly, headerAside, footer = "Ready", footerState = "neutral", highlightLine, language = "json", className = "" }: EditorPanelProps) {
  const FileIcon = language === "json" ? FileJson2 : FileCode2;
  return (
    <section className={`editor-panel ${className}`} aria-label={title}>
      <div className="panel-heading">
        <div className="panel-heading-main">
          <div className={`panel-icon panel-icon-${accent}`}><Icon size={18} strokeWidth={1.8} /></div>
          <div className="panel-title"><h2>{title}</h2><p>{subtitle}</p></div>
        </div>
        {headerAside && <div className="panel-heading-aside">{headerAside}</div>}
      </div>
      <div className="file-bar">
        <div className={`file-tab file-tab-${accent}`}><FileIcon size={14} /><span>{fileName}</span><span className="file-tab-dot" /></div>
        <div className="file-actions">
          {onFormat && <button type="button" onClick={onFormat} title={`Format ${fileName}`}><WandSparkles size={13} /><span>Format</span></button>}
          <button type="button" onClick={onCopy} title={`Copy ${fileName}`}><Copy size={13} /><span>Copy</span></button>
        </div>
      </div>
      <CodeEditor value={value} onChange={onChange} label={title} readOnly={readOnly} highlightLine={highlightLine} language={language} />
      <div className="editor-footer">
        <span className={`editor-footer-status ${footerState}`}><span />{footer}</span>
        <span>{readOnly ? "READ ONLY" : "UTF-8"}<span className="footer-divider" />{value.split("\n").length} LINES</span>
      </div>
    </section>
  );
}

export function StatusBanner({ success, title, description, trailing }: { success: boolean; title: string; description: string; trailing?: ReactNode }) {
  return (
    <div className={`status-banner ${success ? "status-success" : "status-error"}`} role="status" aria-live="polite">
      <div className="status-icon">{success ? <CheckCircle2 size={21} /> : <XCircle size={21} />}</div>
      <div className="status-copy"><strong>{title}</strong><span>{description}</span></div>
      {trailing && <div className="status-trailing">{trailing}</div>}
    </div>
  );
}

export function SuccessTag({ children }: { children: ReactNode }) {
  return <span className="success-tag"><Check size={12} strokeWidth={2.3} />{children}</span>;
}

export function formatJson(value: string): string {
  return JSON.stringify(JSON.parse(value) as unknown, null, 2);
}

export function downloadFile(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string, notify: Notify) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const element = document.createElement("textarea");
      element.value = text;
      element.style.position = "fixed";
      element.style.opacity = "0";
      document.body.appendChild(element);
      element.select();
      const copied = document.execCommand("copy");
      element.remove();
      if (!copied) throw new Error("Copy is unavailable");
    }
    notify("Copied to clipboard");
  } catch {
    notify("Could not copy to clipboard", "error");
  }
}