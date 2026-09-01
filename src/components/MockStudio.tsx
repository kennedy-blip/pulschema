import { Braces, ChevronDown, Database, Download, FileJson2, ListChecks, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { generateMockRecords } from "../lib/mock";
import { compileSchema, parseSchema, type JsonSchema } from "../lib/schema";
import { MOCK_SCHEMAS, SAMPLE_SCHEMA } from "../lib/samples";
import { copyText, downloadFile, EditorPanel, formatJson, PageHeading, StatusBanner, type Notify, WorkspaceLabel } from "./WorkspaceUI";

function initialOutput() {
  try { return JSON.stringify(generateMockRecords(parseSchema(SAMPLE_SCHEMA, "json"), 5), null, 2); }
  catch { return "[]"; }
}

export function MockStudio({ hidden, notify, getValidatorSchema }: { hidden: boolean; notify: Notify; getValidatorSchema: () => JsonSchema }) {
  const [schemaText, setSchemaText] = useState(SAMPLE_SCHEMA);
  const [lastSchema, setLastSchema] = useState(SAMPLE_SCHEMA);
  const [preset, setPreset] = useState("users");
  const [count, setCount] = useState("5");
  const [lastCount, setLastCount] = useState(5);
  const [output, setOutput] = useState(initialOutput);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const dirty = schemaText !== lastSchema || Number(count) !== lastCount;

  function generate(source = schemaText, number = count) {
    const amount = Number(number);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      setError("Enter a whole number between 1 and 100.");
      return;
    }
    setGenerating(true);
    try {
      const schema = parseSchema(source, "json");
      const records = generateMockRecords(schema, amount);
      setOutput(JSON.stringify(records, null, 2));
      setLastSchema(source);
      setLastCount(amount);
      setError("");
      notify(`${amount} mock ${amount === 1 ? "record" : "records"} generated`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not generate records from this schema.");
    } finally {
      setGenerating(false);
    }
  }

  function useValidator() {
    try {
      const schema = getValidatorSchema();
      compileSchema(schema);
      const next = JSON.stringify(schema, null, 2);
      setSchemaText(next);
      setPreset("custom");
      generate(next);
    } catch (issue) {
      notify(issue instanceof Error ? issue.message : "The validator schema is invalid", "error");
    }
  }

  return (
    <div className="workspace-view" hidden={hidden}>
      <PageHeading title="Mock Data Studio" description="Generate realistic, schema-shaped data for your next build." actions={<><button className="button button-secondary" onClick={useValidator}><Braces size={15} /> Use Validator Schema</button><button className="button button-primary" onClick={() => generate()} disabled={generating}><WandSparkles size={15} /> Generate Records</button></>} />
      <WorkspaceLabel title="MOCK DATA WORKSPACE" right={<span className="live-label"><span className="pulse-dot" /> Generated locally</span>} />
      <div className="mock-controls">
        <div className="mock-control-icon"><Database size={17} /></div>
        <div className="mock-control-title"><strong>Generation settings</strong><span>Make it yours</span></div>
        <label className="control-field">DATASET PRESET <span className="select-shell control-select"><select value={preset} onChange={(event) => { const next = event.target.value; setPreset(next); if (MOCK_SCHEMAS[next]) { setSchemaText(MOCK_SCHEMAS[next]); generate(MOCK_SCHEMAS[next]); } }}><option value="users">User profiles</option><option value="transactions">Transactions</option><option value="iot">IoT sensor logs</option><option value="custom">Custom schema</option></select><ChevronDown size={14} /></span></label>
        <label className="control-field count-field">RECORDS <input aria-label="Number of mock records" type="number" min="1" max="100" value={count} onChange={(event) => setCount(event.target.value)} /></label>
        <span className="control-caption">Up to 100 records per run</span>
      </div>
      <div className="editor-grid mock-grid">
        <EditorPanel
          title="Source Schema"
          subtitle="The blueprint for your mock data"
          icon={Braces}
          accent="violet"
          fileName="schema.json"
          value={schemaText}
          onChange={(value) => { setSchemaText(value); setPreset("custom"); }}
          onCopy={() => void copyText(schemaText, notify)}
          onFormat={() => { try { setSchemaText(formatJson(schemaText)); setPreset("custom"); notify("Formatted JSON"); } catch { notify("Fix the JSON syntax before formatting", "error"); } }}
          footer="JSON SCHEMA"
          footerState="neutral"
          headerAside={<span className="language-badge"><span /> JSON</span>}
        />
        <EditorPanel
          title="Generated Data"
          subtitle="Ready to copy, export, or seed"
          icon={FileJson2}
          accent="emerald"
          fileName="mock-data.json"
          value={output}
          readOnly
          onCopy={() => void copyText(output, notify)}
          footer={`${lastCount} ${lastCount === 1 ? "RECORD" : "RECORDS"} GENERATED`}
          footerState="success"
          headerAside={<button className="small-outline-button" onClick={() => { downloadFile("mock-data.json", output, "application/json"); notify("Mock data downloaded"); }}><Download size={13} /> Export JSON</button>}
        />
      </div>
      <StatusBanner success={!error} title={error ? "Unable to generate records" : dirty ? "Ready to regenerate" : "Mock data is ready"} description={error || (dirty ? "Your settings have changed. Generate records to update the output." : `${lastCount} schema-valid ${lastCount === 1 ? "record is" : "records are"} ready for your project.`)} trailing={!error && <button className="banner-action" onClick={() => generate()}><RefreshCw size={14} /> Regenerate</button>} />
      <div className="results-panel compact-results"><div className="results-heading"><div><ListChecks size={16} /><h2>Made for testing</h2></div><span className="results-meta">NO DATA LEAVES YOUR BROWSER</span></div><div className="helper-row"><div className="helper-icon"><Sparkles size={16} /></div><div><strong>Realistic data, without the busywork</strong><p>Names, email addresses, and other fields are generated locally and checked against your schema.</p></div></div></div>
    </div>
  );
}