import { ArrowLeftRight, Braces, Check, Copy, FileJson2, GitCompareArrows, ListChecks, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { compareJson, type Difference } from "../lib/diff";
import { InputError, parseJson } from "../lib/schema";
import { SAMPLE_MODIFIED, SAMPLE_PAYLOAD } from "../lib/samples";
import { copyText, EditorPanel, formatJson, PageHeading, StatusBanner, type Notify, WorkspaceLabel } from "./WorkspaceUI";

function display(value: unknown) {
  const text = JSON.stringify(value);
  if (text === undefined) return "undefined";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function DiffAnalyzer({ hidden, notify }: { hidden: boolean; notify: Notify }) {
  const [before, setBefore] = useState(SAMPLE_PAYLOAD);
  const [after, setAfter] = useState(SAMPLE_MODIFIED);
  const comparison = useMemo(() => {
    let left: unknown;
    let right: unknown;
    try { left = parseJson(before); }
    catch (error) { return { differences: [] as Difference[], error: error instanceof InputError ? error : new InputError("Invalid JSON"), side: "Original" }; }
    try { right = parseJson(after); }
    catch (error) { return { differences: [] as Difference[], error: error instanceof InputError ? error : new InputError("Invalid JSON"), side: "Modified" }; }
    return { differences: compareJson(left, right), error: null, side: "" };
  }, [before, after]);
  const counts = {
    added: comparison.differences.filter((item) => item.kind === "added").length,
    removed: comparison.differences.filter((item) => item.kind === "removed").length,
    changed: comparison.differences.filter((item) => item.kind === "changed").length,
  };
  const format = (value: string, setter: (value: string) => void) => { try { setter(formatJson(value)); notify("Formatted JSON"); } catch { notify("Fix the JSON syntax before formatting", "error"); } };

  return (
    <div className="workspace-view" hidden={hidden}>
      <PageHeading title="Diff Analyzer" description="Spot exactly what changed between two JSON documents." actions={<><button className="button button-secondary" onClick={() => { setBefore(SAMPLE_PAYLOAD); setAfter(SAMPLE_MODIFIED); notify("Sample comparison loaded"); }}><RotateCcw size={15} /> Load Sample</button><button className="button button-primary" onClick={() => { setBefore(after); setAfter(before); notify("Documents swapped"); }}><ArrowLeftRight size={15} /> Swap Documents</button></>} />
      <WorkspaceLabel title="DIFF ANALYZER WORKSPACE" right={<span className="live-label"><span className="pulse-dot" /> Comparing in real time</span>} />
      <div className="editor-grid">
        <EditorPanel title="Original JSON" subtitle="Your starting point" icon={FileJson2} accent="blue" fileName="original.json" value={before} onChange={setBefore} onCopy={() => void copyText(before, notify)} onFormat={() => format(before, setBefore)} footer={comparison.side === "Original" ? "SYNTAX ERROR" : "JSON INPUT"} footerState={comparison.side === "Original" ? "error" : "success"} highlightLine={comparison.side === "Original" ? comparison.error?.line : undefined} headerAside={<span className="language-badge"><span /> JSON</span>} />
        <EditorPanel title="Modified JSON" subtitle="Compare this against the original" icon={Braces} accent="violet" fileName="modified.json" value={after} onChange={setAfter} onCopy={() => void copyText(after, notify)} onFormat={() => format(after, setAfter)} footer={comparison.side === "Modified" ? "SYNTAX ERROR" : "JSON INPUT"} footerState={comparison.side === "Modified" ? "error" : "success"} highlightLine={comparison.side === "Modified" ? comparison.error?.line : undefined} headerAside={<span className="language-badge"><span /> JSON</span>} />
      </div>
      <StatusBanner success={!comparison.error} title={comparison.error ? `${comparison.side} JSON has a syntax error` : comparison.differences.length ? `${comparison.differences.length} ${comparison.differences.length === 1 ? "difference" : "differences"} found` : "Documents match"} description={comparison.error ? `${comparison.error.message} at line ${comparison.error.line}, column ${comparison.error.column}.` : comparison.differences.length ? "Here's what changed between your JSON documents." : "Both documents contain the same JSON values."} trailing={!comparison.error && <span className="diff-counts"><span>+{counts.added} added</span><span>-{counts.removed} removed</span><span>~{counts.changed} changed</span></span>} />
      <div className="results-panel">
        <div className="results-heading"><div><ListChecks size={16} /><h2>Comparison results</h2><span className="results-count">{comparison.differences.length}</span></div>{!comparison.error && comparison.differences.length > 0 && <button className="text-action" onClick={() => void copyText(JSON.stringify(comparison.differences, null, 2), notify)}><Copy size={13} /> Copy report</button>}</div>
        {comparison.error ? <div className="helper-row"><div className="helper-icon"><GitCompareArrows size={16} /></div><div><strong>Waiting for valid JSON</strong><p>Fix the syntax error to see your comparison.</p></div></div> : comparison.differences.length === 0 ? <div className="results-success"><div className="results-check"><Check size={17} /></div><div><strong>No differences found</strong><p>Your JSON documents are structurally identical.</p></div></div> : <div className="diff-list">{comparison.differences.slice(0, 50).map((item, index) => <div className="diff-row" key={`${item.path}-${index}`}><span className={`diff-kind ${item.kind}`}>{item.kind === "added" ? "+" : item.kind === "removed" ? "-" : "~"}</span><div><strong>{item.path}</strong><p>{item.kind === "changed" ? <><span className="diff-old">{display(item.before)}</span><span className="diff-arrow"> &rarr; </span><span className="diff-new">{display(item.after)}</span></> : <span className={item.kind === "added" ? "diff-new" : "diff-old"}>{display(item.kind === "added" ? item.after : item.before)}</span>}</p></div><span className={`diff-text ${item.kind}`}>{item.kind}</span></div>)}{comparison.differences.length > 50 && <p className="issue-overflow">Showing 50 of {comparison.differences.length} differences.</p>}</div>}
      </div>
    </div>
  );
}