import { useCallback, useEffect, useMemo, useState } from "react";
import { Braces, Check, ChevronRight, CircleHelp, Code2, Database, ExternalLink, GitCompareArrows, Layers3, LockKeyhole, ShieldCheck, Waypoints, X } from "lucide-react";
import { SchemaValidator } from "./components/SchemaValidator";
import { TypeGenerator } from "./components/TypeGenerator";
import { MockStudio } from "./components/MockStudio";
import { DiffAnalyzer } from "./components/DiffAnalyzer";
import { downloadFile, type Notify } from "./components/WorkspaceUI";
import { schemaToTypeScript } from "./lib/generators";
import { compileSchema, parseSchema, type SchemaMode, validateDocuments } from "./lib/schema";
import { SAMPLE_PAYLOAD, SAMPLE_SCHEMA, SAMPLE_ZOD } from "./lib/samples";

type View = "validator" | "generator" | "mock" | "diff";
const navigation = [
  { id: "validator" as const, label: "Schema Validator", icon: ShieldCheck },
  { id: "generator" as const, label: "TS/Zod Generator", icon: Code2 },
  { id: "mock" as const, label: "Mock Data Studio", icon: Database },
  { id: "diff" as const, label: "Diff Analyzer", icon: GitCompareArrows },
];

export default function App() {
  const [active, setActive] = useState<View>("validator");
  const [mode, setMode] = useState<SchemaMode>("json");
  const [jsonSchema, setJsonSchema] = useState(SAMPLE_SCHEMA);
  const [zodSchema, setZodSchema] = useState(SAMPLE_ZOD);
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; id: number } | null>(null);
  const schemaText = mode === "json" ? jsonSchema : zodSchema;
  const result = useMemo(() => validateDocuments(schemaText, mode, payload), [schemaText, mode, payload]);
  const activeLabel = navigation.find((item) => item.id === active)?.label ?? "Schema Validator";

  const notify: Notify = useCallback((message, type = "success") => setToast({ message, type, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  function loadSample() {
    setJsonSchema(SAMPLE_SCHEMA);
    setZodSchema(SAMPLE_ZOD);
    setPayload(SAMPLE_PAYLOAD);
    setMode("json");
    setActive("validator");
    notify("Sample schema and payload loaded");
  }

  function exportTypes() {
    try {
      const schema = parseSchema(schemaText, mode);
      compileSchema(schema);
      const name = typeof schema === "object" && typeof schema.title === "string" ? schema.title : "Root";
      downloadFile("schema-types.ts", schemaToTypeScript(schema, name));
      notify("TypeScript definitions downloaded");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Fix your schema before exporting", "error");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => setActive("validator")} aria-label="SchemaPulse home">
            <span className="brand-mark"><Waypoints size={22} strokeWidth={1.7} /></span>
            <span className="brand-name">Schema<span>Pulse</span><i /></span>
          </button>
          <nav className="main-nav" aria-label="Main navigation">
            {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? "active" : ""}`} onClick={() => setActive(id)} aria-current={active === id ? "page" : undefined}><Icon size={15} strokeWidth={1.8} /><span>{label}</span></button>)}
          </nav>
          <div className="topbar-right">
            <div className="engine-status" aria-label="Validation Engine: Active"><span className="pulse-dot" /><span>Validation Engine: <strong>Active</strong></span></div>
            <span className="topbar-divider" />
            <button className="icon-button help-button" aria-label="Open workspace help" title="Workspace help" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="breadcrumbs"><span className="breadcrumb-home"><Layers3 size={14} /> WORKSPACE</span><ChevronRight size={13} /><span className="breadcrumb-current">{activeLabel.toUpperCase()}</span><span className="breadcrumb-right"><span className="mini-dot" /> ALL SYSTEMS OPERATIONAL</span></div>
        <SchemaValidator hidden={active !== "validator"} mode={mode} setMode={setMode} schemaText={schemaText} setSchemaText={mode === "json" ? setJsonSchema : setZodSchema} payload={payload} setPayload={setPayload} result={result} onLoadSample={loadSample} onExport={exportTypes} notify={notify} />
        <TypeGenerator hidden={active !== "generator"} notify={notify} />
        <MockStudio hidden={active !== "mock"} notify={notify} getValidatorSchema={() => parseSchema(schemaText, mode)} />
        <DiffAnalyzer hidden={active !== "diff"} notify={notify} />
        <footer className="app-footer"><span><LockKeyhole size={12} /> BUILT FOR DEVELOPERS, WITH PRIVACY IN MIND.</span><span>SCHEMAPULSE <span className="footer-version">/</span> YOUR DATA. YOUR RULES.</span></footer>
      </main>

      {toast && <div className={`toast ${toast.type}`} key={toast.id} role="status"><span>{toast.type === "success" ? <Check size={15} /> : <X size={15} />}</span>{toast.message}</div>}

      {helpOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="modal-top"><span className="modal-icon"><Braces size={20} /></span><button className="icon-button" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={18} /></button></div><h2 id="help-title">A little workspace guide<span className="title-period">.</span></h2><p>Everything you need to go from JSON to production, without leaving your browser.</p><div className="help-list"><div><strong>Validate in real time</strong><span>Choose JSON Schema or a Zod definition, then edit your payload to see precise errors.</span></div><div><strong>Supported schemas</strong><span>JSON Schema Draft-07, 2019-09 and 2020-12 are supported. Zod input supports common schema types and validators; custom refinements and arbitrary code are not executed.</span></div><div><strong>Stay in control</strong><span>All validation, generation, and comparisons run locally on your device. Press Tab in an editor to indent.</span></div></div><a href="https://json-schema.org/learn/getting-started-step-by-step" target="_blank" rel="noreferrer">Explore JSON Schema docs <ExternalLink size={14} /></a></section></div>}
    </div>
  );
}
