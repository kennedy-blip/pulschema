import { Braces, ChevronDown, Code2, Download, FileJson2, ListChecks, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { inferSchema, schemaToPydantic, schemaToTypeScript, schemaToZod } from "../lib/generators";
import { InputError, parseJson } from "../lib/schema";
import { SAMPLE_PAYLOAD } from "../lib/samples";
import { copyText, downloadFile, EditorPanel, formatJson, PageHeading, StatusBanner, type Notify, WorkspaceLabel } from "./WorkspaceUI";

type Output = "typescript" | "zod" | "pydantic";
const labels: Record<Output, string> = { typescript: "TypeScript", zod: "Zod", pydantic: "Pydantic" };
const files: Record<Output, string> = { typescript: "types.ts", zod: "schema.ts", pydantic: "models.py" };

export function TypeGenerator({ hidden, notify }: { hidden: boolean; notify: Notify }) {
  const [sample, setSample] = useState(SAMPLE_PAYLOAD);
  const [name, setName] = useState("User");
  const [output, setOutput] = useState<Output>("typescript");

  const generated = useMemo(() => {
    try {
      const schema = inferSchema(parseJson(sample));
      const code = output === "typescript" ? schemaToTypeScript(schema, name) : output === "zod" ? schemaToZod(schema, name) : schemaToPydantic(schema, name);
      return { code, error: null as InputError | null };
    } catch (error) {
      const issue = error instanceof InputError ? error : new InputError(error instanceof Error ? error.message : "Invalid JSON");
      return { code: `${output === "pydantic" ? "#" : "//"} Fix the JSON sample to generate code.\n`, error: issue };
    }
  }, [sample, name, output]);

  function download() {
    if (generated.error) return notify("Fix the JSON sample before exporting", "error");
    downloadFile(files[output], generated.code);
    notify(`${labels[output]} file downloaded`);
  }

  return (
    <div className="workspace-view" hidden={hidden}>
      <PageHeading title="Type Generator" description="Turn a JSON sample into types and schemas, in seconds." actions={<><button className="button button-secondary" onClick={() => { setSample(SAMPLE_PAYLOAD); setName("User"); notify("Sample JSON loaded"); }}><RotateCcw size={15} /> Load Sample JSON</button><button className="button button-primary" onClick={download}><Download size={15} /> Download Code</button></>} />
      <WorkspaceLabel title="TYPE GENERATOR WORKSPACE" right={<span className="live-label"><span className="pulse-dot" /> Generates as you type</span>} />
      <div className="editor-grid">
        <EditorPanel
          title="JSON Sample"
          subtitle="Paste an example of your data"
          icon={FileJson2}
          accent="emerald"
          fileName="sample.json"
          value={sample}
          onChange={setSample}
          onCopy={() => void copyText(sample, notify)}
          onFormat={() => { try { setSample(formatJson(sample)); notify("Formatted JSON"); } catch { notify("Fix the JSON syntax before formatting", "error"); } }}
          footer={generated.error ? "SYNTAX ERROR" : "JSON INPUT"}
          footerState={generated.error ? "error" : "success"}
          highlightLine={generated.error?.line}
          headerAside={<span className="language-badge"><span /> JSON</span>}
        />
        <EditorPanel
          title="Generated Code"
          subtitle="Ready to add to your project"
          icon={Code2}
          accent="violet"
          fileName={files[output]}
          value={generated.code}
          readOnly
          language={output === "pydantic" ? "python" : "typescript"}
          onCopy={() => { if (generated.error) notify("Fix the JSON sample before copying", "error"); else void copyText(generated.code, notify); }}
          footer={generated.error ? "WAITING FOR INPUT" : "GENERATED OUTPUT"}
          footerState={generated.error ? "error" : "success"}
          headerAside={<label className="select-shell output-select"><span className="sr-only">Output language</span><select value={output} onChange={(event) => setOutput(event.target.value as Output)}><option value="typescript">TypeScript</option><option value="zod">Zod</option><option value="pydantic">Pydantic</option></select><ChevronDown size={13} /></label>}
        />
      </div>
      <div className="generator-settings"><div className="settings-intro"><Braces size={16} /><span>Generation settings</span></div><label>ROOT TYPE NAME <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Root" aria-label="Root type name" /></label><span className="settings-hint">Your code updates automatically as you edit.</span></div>
      <StatusBanner success={!generated.error} title={generated.error ? "JSON syntax error" : "Your types are ready"} description={generated.error ? `${generated.error.message} at line ${generated.error.line}, column ${generated.error.column}.` : `Your ${labels[output]} definition is generated from the sample above.`} trailing={!generated.error && <span className="generated-label"><Sparkles size={14} /> IN SYNC</span>} />
      <div className="results-panel compact-results"><div className="results-heading"><div><ListChecks size={16} /><h2>About this output</h2></div><span className="results-meta">INFERRED FROM JSON</span></div><div className="helper-row"><div className="helper-icon"><Sparkles size={16} /></div><div><strong>Built from your data, not guesswork</strong><p>Nested objects, arrays, nullable values, and optional properties are inferred from your sample.</p></div></div></div>
    </div>
  );
}