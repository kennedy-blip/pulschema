import { Braces, Check, ChevronDown, CircleCheck, Download, FileJson2, Info, ListChecks, RotateCcw, ShieldCheck } from "lucide-react";
import type { SchemaMode, ValidationResult } from "../lib/schema";
import { copyText, EditorPanel, formatJson, PageHeading, StatusBanner, SuccessTag, type Notify, WorkspaceLabel } from "./WorkspaceUI";

type Props = {
  hidden: boolean;
  mode: SchemaMode;
  setMode: (mode: SchemaMode) => void;
  schemaText: string;
  setSchemaText: (value: string) => void;
  payload: string;
  setPayload: (value: string) => void;
  result: ValidationResult;
  onLoadSample: () => void;
  onExport: () => void;
  notify: Notify;
};

export function SchemaValidator({ hidden, mode, setMode, schemaText, setSchemaText, payload, setPayload, result, onLoadSample, onExport, notify }: Props) {
  const format = (value: string, setter: (value: string) => void) => {
    try { setter(formatJson(value)); notify("Formatted JSON"); }
    catch { notify("Fix the JSON syntax before formatting", "error"); }
  };
  const issue = result.issues[0];
  return (
    <div className="workspace-view" hidden={hidden}>
      <PageHeading
        title="Schema Validator"
        description="Validate your JSON data against a schema, instantly."
        actions={<><button className="button button-secondary" onClick={onLoadSample}><RotateCcw size={15} /> Load Sample Schema</button><button className="button button-primary" onClick={onExport}><Download size={15} /> Export TypeScript <span className="action-extra">Definitions</span></button></>}
      />
      <WorkspaceLabel title="VALIDATION WORKSPACE" right={<span className="live-label"><span className="pulse-dot" /> Live validation <span className="live-on">ON</span></span>} />
      <div className="editor-grid">
        <EditorPanel
          title={mode === "json" ? "JSON Schema" : "Zod Definition"}
          subtitle="Define the structure of your data"
          icon={Braces}
          accent="violet"
          fileName={mode === "json" ? "schema.json" : "schema.ts"}
          language={mode === "json" ? "json" : "typescript"}
          value={schemaText}
          onChange={setSchemaText}
          onCopy={() => void copyText(schemaText, notify)}
          onFormat={mode === "json" ? () => format(schemaText, setSchemaText) : undefined}
          footer={result.kind === "schema" ? "SCHEMA ERROR" : "SCHEMA READY"}
          footerState={result.kind === "schema" ? "error" : "success"}
          highlightLine={result.kind === "schema" ? issue?.line : undefined}
          headerAside={<label className="select-shell" title="Schema definition format"><span className="sr-only">Schema definition format</span><select value={mode} onChange={(event) => setMode(event.target.value as SchemaMode)}><option value="json">JSON Schema</option><option value="zod">Zod definition</option></select><ChevronDown size={13} /></label>}
        />
        <EditorPanel
          title="JSON Payload"
          subtitle="The data you want to validate"
          icon={FileJson2}
          accent="emerald"
          fileName="payload.json"
          value={payload}
          onChange={setPayload}
          onCopy={() => void copyText(payload, notify)}
          onFormat={() => format(payload, setPayload)}
          footer={result.kind === "payload" ? "SYNTAX ERROR" : "JSON INPUT"}
          footerState={result.kind === "payload" ? "error" : "success"}
          highlightLine={result.kind === "payload" || result.kind === "validation" ? issue?.line : undefined}
          headerAside={<span className="language-badge"><span /> JSON</span>}
        />
      </div>
      {mode === "zod" && <div className="schema-mode-note"><Info size={13} /><span>Zod mode supports common schema types and validators. Custom refinements and arbitrary code are not executed.</span></div>}
      <StatusBanner success={result.valid} title={result.title} description={result.description} trailing={result.valid ? <><span className="status-trailing-label">VALIDATION STATUS</span><SuccessTag>Passed</SuccessTag></> : <><span className="status-trailing-label">ISSUES FOUND</span><span className="error-count">{result.issues.length} {result.issues.length === 1 ? "error" : "errors"}</span></>} />
      <div className="results-panel">
        <div className="results-heading"><div><ListChecks size={16} /><h2>Validation results</h2><span className="results-count">{result.issues.length}</span></div><span className="results-meta"><span className="mini-dot" /> UPDATED IN REAL TIME</span></div>
        {result.valid ? (
          <div className="results-success">
            <div className="results-check"><Check size={17} strokeWidth={2.4} /></div>
            <div><strong>All checks passed</strong><p>No errors found. Your payload is looking good.</p></div>
            <div className="results-passed"><CircleCheck size={14} /> Schema and payload match</div>
          </div>
        ) : (
          <div className="issue-list">
            {result.issues.slice(0, 20).map((entry, index) => <div className="issue-row" key={`${entry.path}-${index}`}><span className="issue-bullet">!</span><div><strong>{entry.message}</strong><p>{entry.path} <span className="issue-separator">/</span> line {entry.line}, column {entry.column}</p></div><span className="issue-location">Ln {entry.line}, Col {entry.column}</span></div>)}
            {result.issues.length > 20 && <p className="issue-overflow">Showing 20 of {result.issues.length} issues.</p>}
          </div>
        )}
      </div>
      <div className="workspace-note"><ShieldCheck size={14} /><span>Privacy first. Your data is processed locally and never leaves your browser.</span></div>
    </div>
  );
}