import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { jsPDF } from "jspdf";
import { AlertCircle, Archive, ArrowDown, Check, ChevronDown, Clipboard, Database, Download, FileCode2, FileText, Gauge, KeyRound, Layers3, Loader2, Orbit, PanelRight, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { AdaptiveNav } from "@/components/ui/AdaptiveNav";
import { trpc } from "@/lib/trpc";
import type { ChunkRecord, DocumentRecord, ProjectedPoint, QueryRecord, WorkspaceSnapshot } from "@shared/types";

const EmbeddingUniverse = lazy(() => import("@/components/scene/EmbeddingUniverse"));

const defaultWorkspaceId = () => {
  try {
    const stored = sessionStorage.getItem("rq-workspace-id");
    if (stored) return stored;
    const next = crypto.randomUUID();
    sessionStorage.setItem("rq-workspace-id", next);
    return next;
  } catch {
    return `workspace-${Math.random().toString(36).slice(2)}`;
  }
};

const formatMs = (value?: number) => (typeof value === "number" ? `${value} ms` : "—");
const formatBytes = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
const stageText = (stage: DocumentRecord["stage"]) => ({ queued: "Queued", validating: "Validating", extracting: "Extracting", chunking: "Chunking", embedding: "Embedding", indexing: "Indexing", ready: "Ready", error: "Error" })[stage];

function encodeFile(file: File) {
  return new Promise<{ name: string; mimeType: string; size: number; contentBase64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, contentBase64: String(reader.result).split(",")[1] || "" });
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPdf(query: QueryRecord, model: string) {
  const document = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 46;
  const width = 595 - margin * 2;
  document.setFont("courier", "bold");
  document.setFontSize(15);
  document.text("RAG QUANTUM LAB", margin, 52);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.setTextColor(105, 111, 111);
  document.text(`Evidence report · ${new Date(query.createdAt).toLocaleString()} · ${model}`, margin, 70);
  document.setTextColor(25, 28, 28);
  document.setFontSize(11);
  document.setFont("helvetica", "bold");
  document.text("Question", margin, 104);
  document.setFont("helvetica", "normal");
  let y = 122;
  const writeBlock = (text: string, size = 10, gap = 18) => {
    document.setFontSize(size);
    const lines = document.splitTextToSize(text, width);
    if (y + lines.length * 14 > 760) { document.addPage(); y = 54; }
    document.text(lines, margin, y);
    y += lines.length * 14 + gap;
  };
  writeBlock(query.question, 10, 22);
  document.setFont("helvetica", "bold");
  document.text("Grounded answer", margin, y);
  y += 18;
  document.setFont("helvetica", "normal");
  writeBlock(query.answer || "No answer returned.", 10, 20);
  document.setFont("helvetica", "bold");
  document.text("Retrieved evidence", margin, y);
  y += 18;
  document.setFont("helvetica", "normal");
  query.citations.forEach(citation => writeBlock(`[${citation.chunkId}] ${citation.sourceName} · ${citation.location}\n${citation.quote}`, 9, 14));
  document.setFontSize(8);
  document.setTextColor(105, 111, 111);
  document.text(`Query embedding ${formatMs(query.timings.queryEmbeddingMs)} · Retrieval ${formatMs(query.timings.retrievalMs)} · Generation ${formatMs(query.timings.generationMs)} · Total ${formatMs(query.timings.totalMs)}`, margin, 790);
  document.save(`rag-quantum-${query.id}.pdf`);
}

function StatusDot({ tone = "neutral" }: { tone?: "ready" | "warn" | "error" | "neutral" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function SectionLabel({ eyebrow, title, count }: { eyebrow: string; title: string; count?: string | number }) {
  return <div className="section-label"><div><span>{eyebrow}</span><h2>{title}</h2></div>{count !== undefined && <strong>{count}</strong>}</div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Archive; title: string; body: string }) {
  return <div className="empty-state"><Icon size={18} strokeWidth={1.4} /><strong>{title}</strong><p>{body}</p></div>;
}

export default function Home() {
  const [workspaceId] = useState(defaultWorkspaceId);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | undefined>();
  const [apiKey, setApiKey] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-004");
  const [generationModel, setGenerationModel] = useState("gemini-2.0-flash");
  const [chunkSize, setChunkSize] = useState(780);
  const [overlap, setOverlap] = useState(120);
  const [topK, setTopK] = useState(5);
  const [question, setQuestion] = useState("");
  const [selectedChunkId, setSelectedChunkId] = useState<string>();
  const [hoveredPoint, setHoveredPoint] = useState<ProjectedPoint>();
  const [activeQueryId, setActiveQueryId] = useState<string>();
  const [resetToken, setResetToken] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("sources");
  const [localError, setLocalError] = useState("");
  const [lastEvent, setLastEvent] = useState("");

  const snapshotQuery = trpc.rag.snapshot.useQuery({ workspaceId }, { refetchOnWindowFocus: false });
  const ingestMutation = trpc.rag.ingest.useMutation({ onSuccess: result => { setSnapshot(result.snapshot); setLastEvent(result.events.at(-1)?.message || "Pipeline complete"); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const queryMutation = trpc.rag.query.useMutation({ onSuccess: result => { setSnapshot(result.snapshot); setActiveQueryId(result.query.id); setLastEvent(result.query.status === "insufficient" ? "Generation returned with insufficient evidence" : "Grounded answer returned from the selected evidence"); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const indexMutation = trpc.rag.indexExtracted.useMutation({ onSuccess: result => { setSnapshot(result.snapshot); setLastEvent(result.events.at(-1)?.message || "Extracted chunks indexed"); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const removeMutation = trpc.rag.removeDocument.useMutation({ onSuccess: result => { setSnapshot(result); setSelectedChunkId(undefined); } });

  useEffect(() => { if (snapshotQuery.data && !snapshot) setSnapshot(snapshotQuery.data); }, [snapshot, snapshotQuery.data]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveNav(visible.target.id);
    }, { rootMargin: "-25% 0px -55%", threshold: [0.05, 0.25, 0.7] });
    ["sources", "universe", "retrieval", "method"].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);

  const current = snapshot || snapshotQuery.data;
  const activeQuery = current?.queries.find(queryRecord => queryRecord.id === activeQueryId) || current?.queries[0];
  const selectedChunk = current?.chunks.find(chunk => chunk.id === selectedChunkId);
  const highlightedIds = useMemo(() => new Set(activeQuery?.results.map(result => result.id) || []), [activeQuery]);
  const readyDocuments = current?.documents.filter(document => document.status === "ready").length || 0;
  const extractedDocuments = current?.documents.filter(document => document.status === "extracted").length || 0;
  const indexedCount = current?.points.length || 0;
  const latestStage = queryMutation.isPending ? "retrieval" : ingestMutation.isPending ? "indexing" : activeQuery ? "answer" : indexedCount ? "ready" : current?.chunks.length ? "extracted" : "awaiting";

  const ingestFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setLocalError("");
    try {
      const encoded = await Promise.all(files.slice(0, 12).map(encodeFile));
      ingestMutation.mutate({ workspaceId, files: encoded, apiKey: apiKey || undefined, embeddingModel, chunkSize, overlap });
    } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not read the selected files."); }
  }, [apiKey, chunkSize, embeddingModel, ingestMutation, overlap, workspaceId]);

  const handleQuery = () => {
    if (!apiKey.trim()) { setLocalError("Add a Gemini API key in Configure before querying. The key stays in this session and is not stored."); setSettingsOpen(true); return; }
    queryMutation.mutate({ workspaceId, question, apiKey, embeddingModel, generationModel, topK });
  };

  const copy = async (content: string) => {
    try { await navigator.clipboard.writeText(content); setLocalError(""); } catch { setLocalError("Clipboard access was unavailable in this browser."); }
  };

  const exportAnswer = () => {
    if (!activeQuery) return;
    const citations = activeQuery.citations.map(citation => `[${citation.chunkId}] ${citation.sourceName} · ${citation.location}\n${citation.quote}`).join("\n\n");
    downloadText(`rag-quantum-${activeQuery.id}.txt`, `RAG QUANTUM LAB\n\nQUESTION\n${activeQuery.question}\n\nANSWER\n${activeQuery.answer || "No answer returned."}\n\nCITATIONS\n${citations}\n\nTIMINGS\nQuery embedding: ${formatMs(activeQuery.timings.queryEmbeddingMs)}\nRetrieval: ${formatMs(activeQuery.timings.retrievalMs)}\nGeneration: ${formatMs(activeQuery.timings.generationMs)}\nTotal: ${formatMs(activeQuery.timings.totalMs)}`);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); void ingestFiles(Array.from(event.dataTransfer.files)); };
  const currentTone = localError ? "error" : indexedCount ? "ready" : current?.chunks.length ? "warn" : "neutral";

  return (
    <div className="lab-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /></div><div><div className="brand-name">RAG QUANTUM LAB</div><div className="brand-subtitle">retrieval observatory / capstone workspace</div></div></div>
        <AdaptiveNav activeId={activeNav} />
        <div className="topbar-status"><StatusDot tone={currentTone} /><span>{indexedCount ? "INDEX READY" : current?.chunks.length ? "CHUNKS EXTRACTED" : "AWAITING SOURCE"}</span><button className="icon-button" onClick={() => setSettingsOpen(value => !value)} aria-label="Open configuration"><Settings2 size={16} /></button></div>
      </header>

      <main className="workspace-grid">
        <section id="sources" className="rail rail-left" aria-label="Sources and ingestion">
          <SectionLabel eyebrow="01 / INGESTION" title="Source register" count={current?.documents.length || 0} />
          <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
            <UploadCloud size={23} strokeWidth={1.35} />
            <strong>Drop documents here</strong>
            <span>or <label htmlFor="file-input">select files</label></span>
            <input id="file-input" type="file" multiple hidden accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.css,.scss,.yml,.yaml,.sql,.env,.pdf,.docx,.xlsx,.xls" onChange={event => { void ingestFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
            <small>TXT · MD · CSV · JSON · HTML · XML · PDF · DOCX · XLSX</small>
          </div>
          <div className="rail-rule" />
          <div className="source-list">
            {current?.documents.length ? current.documents.map(document => (
              <article className={`source-row ${document.status === "error" ? "source-row--error" : ""}`} key={document.id}>
                <div className="source-icon"><FileText size={15} /></div>
                <div className="source-row__body"><strong title={document.name}>{document.name}</strong><span>{formatBytes(document.size)} · {document.chunkCount || "—"} chunks</span><div className={`source-progress ${document.status === "processing" ? "is-indeterminate" : ""}`}><i style={{ width: document.status === "error" || document.status === "ready" || document.status === "extracted" ? "100%" : undefined }} /></div><small className={document.status === "error" ? "text-error" : ""}>{stageText(document.stage)}{document.error ? ` · ${document.error}` : ""}</small></div><button className="row-action" onClick={() => removeMutation.mutate({ workspaceId, documentId: document.id })} aria-label={`Remove ${document.name}`}><Trash2 size={14} /></button>
              </article>
            )) : <EmptyState icon={Archive} title="No sources yet" body="The index stays empty until you add a document. Extraction and chunking happen on the server." />}
          </div>
          {extractedDocuments > 0 && <button className="index-extracted-button" disabled={indexMutation.isPending} onClick={() => { if (!apiKey) { setSettingsOpen(true); setLocalError("Add a Gemini API key in Configure before indexing extracted chunks."); return; } indexMutation.mutate({ workspaceId, apiKey, embeddingModel }); }}>{indexMutation.isPending ? <Loader2 size={13} className="spin" /> : <Database size={13} />} {apiKey ? `index ${extractedDocuments} extracted source${extractedDocuments === 1 ? "" : "s"}` : "configure key to index"}</button>}
          <div className="left-footnote"><span className="mono">SESSION</span><span>{workspaceId.slice(0, 10)}…</span><span className="mono">PERSISTENCE</span><span>session memory</span></div>
        </section>

        <section id="universe" className="universe-panel" aria-label="3D embedding universe">
          <div className="universe-heading"><div><span className="eyebrow">02 / VECTOR SPACE</span><h1>Embedding universe</h1><p>{lastEvent || (indexedCount ? `${indexedCount} indexed chunk${indexedCount === 1 ? "" : "s"} projected with PCA` : "A spatial view of the indexed evidence will appear here.")}</p></div><div className="universe-actions"><button className="small-button" onClick={() => setResetToken(value => value + 1)}><RefreshCw size={13} /> reset</button><button className="small-button" onClick={() => setFitToken(value => value + 1)} disabled={!indexedCount}><Orbit size={13} /> fit</button></div></div>
          <div className="scene-frame">
            <div className="scene-meta scene-meta--tl"><span className="mono">PROJECTION</span><strong>PCA-STYLE / 3 AXES</strong></div>
            <div className="scene-meta scene-meta--tr"><span className="mono">POINTS</span><strong>{String(indexedCount).padStart(3, "0")}</strong></div>
            <Suspense fallback={<div className="scene-fallback"><Loader2 size={18} className="spin" /> Loading spatial renderer</div>}><EmbeddingUniverse points={current?.points || []} queryProjection={activeQuery?.queryProjection} highlightedIds={highlightedIds} selectedId={selectedChunkId} onSelect={point => setSelectedChunkId(point.chunkId)} onHover={setHoveredPoint} resetToken={resetToken} fitToken={fitToken} reducedMotion={window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false} /></Suspense>
            {hoveredPoint && <div className="point-tooltip"><span className="mono">{hoveredPoint.chunkId}</span><strong>{hoveredPoint.sourceName}</strong><p>{hoveredPoint.excerpt}</p></div>}
            {!indexedCount && <div className="scene-empty"><div className="scene-crosshair"><span /><i /></div><strong>Awaiting indexed vectors</strong><span>Upload a source, then configure embeddings to activate the field.</span></div>}
            <div className="scene-legend"><span><i className="legend-dot legend-dot--chunk" /> indexed chunk</span><span><i className="legend-dot legend-dot--query" /> query vector</span><span><i className="legend-dot legend-dot--retrieved" /> retrieved</span></div>
          </div>
          <div className="pipeline-rail"><span className="mono">PIPELINE</span>{["extract", "chunk", "embed", "index", "retrieve", "answer"].map((stage, index) => { const active = ["extract", "chunk", "embed", "index", "retrieve", "answer"].indexOf(latestStage) >= index || (latestStage === "ready" && index < 4); return <div className={`pipeline-step ${active ? "is-active" : ""}`} key={stage}><b>{String(index + 1).padStart(2, "0")}</b><span>{stage}</span>{index < 5 && <i />}</div>; })}</div>
        </section>

        <section id="retrieval" className="rail rail-right" aria-label="Query and evidence">
          <SectionLabel eyebrow="03 / QUERY" title="Research prompt" />
          <div className="query-box"><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleQuery(); }} placeholder="Ask a question of the indexed evidence…" rows={4} /><div className="query-box__footer"><span className="mono">⌘↵ TO RETRIEVE</span><button className="run-button" onClick={handleQuery} disabled={queryMutation.isPending || !question.trim()}>{queryMutation.isPending ? <Loader2 size={14} className="spin" /> : <Search size={14} />} retrieve</button></div></div>
          <div className="query-controls"><label>TOP-K <input type="number" min={1} max={10} value={topK} onChange={event => setTopK(Number(event.target.value) || 1)} /></label><button className={`configure-button ${settingsOpen ? "is-open" : ""}`} onClick={() => setSettingsOpen(value => !value)}><SlidersHorizontal size={13} /> configure</button></div>
          {settingsOpen && <div className="settings-drawer"><div className="settings-heading"><span><KeyRound size={13} /> SESSION CONFIGURATION</span><button onClick={() => setSettingsOpen(false)} aria-label="Close configuration"><X size={14} /></button></div><label>Gemini API key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Held in memory for this session" autoComplete="off" /></label><div className="settings-grid"><label>Embedding model<input value={embeddingModel} onChange={event => setEmbeddingModel(event.target.value)} /></label><label>Generation model<input value={generationModel} onChange={event => setGenerationModel(event.target.value)} /></label><label>Chunk size<input type="number" min={160} max={4000} value={chunkSize} onChange={event => setChunkSize(Number(event.target.value) || 780)} /></label><label>Overlap<input type="number" min={0} max={2000} value={overlap} onChange={event => setOverlap(Number(event.target.value) || 0)} /></label></div><p className="settings-note">The key is sent only to the server for the current operation. It is not stored in localStorage, exported, or rendered into the interface.</p></div>}
          {localError && <div className="error-banner"><AlertCircle size={15} /><span>{localError}</span><button onClick={() => setLocalError("")} aria-label="Dismiss error"><X size={13} /></button></div>}
          <div className="rail-rule" />
          <div className="retrieval-header"><span className="eyebrow">EVIDENCE TRACE</span><span className="mono">{activeQuery ? `${activeQuery.results.length} CANDIDATES` : "NO RUN"}</span></div>
          <div className="result-list">
            {activeQuery?.results.length ? activeQuery.results.map(result => <button className={`result-row ${highlightedIds.has(result.id) ? "is-highlighted" : ""} ${selectedChunkId === result.id ? "is-selected" : ""}`} key={result.id} onClick={() => setSelectedChunkId(result.id)}><span className="rank">{String(result.rank).padStart(2, "0")}</span><span className="result-body"><strong>{result.sourceName}</strong><small>{result.location}</small><p>{result.text.slice(0, 118)}{result.text.length > 118 ? "…" : ""}</p></span><span className="score"><b>{result.score.toFixed(3)}</b><small>cos</small></span></button>) : <EmptyState icon={Search} title="No retrieval run" body="Submit a question once indexed vectors are available. Results will show true cosine scores." />}
          </div>
          {activeQuery && <div className="history-strip"><span className="mono">QUERY HISTORY</span><div>{current?.queries.slice(0, 4).map(queryRecord => <button className={queryRecord.id === activeQuery.id ? "is-active" : ""} key={queryRecord.id} onClick={() => setActiveQueryId(queryRecord.id)} title={queryRecord.question}>{queryRecord.question.slice(0, 24)}{queryRecord.question.length > 24 ? "…" : ""}</button>)}</div></div>}
        </section>
      </main>

      <section id="method" className="answer-band" aria-label="Grounded answer and method">
        <div className="answer-column"><div className="answer-heading"><div><span className="eyebrow">04 / GROUNDED OUTPUT</span><h2>Answer surface</h2></div>{activeQuery && <div className="answer-actions"><button onClick={() => copy(activeQuery.answer || "")}><Clipboard size={13} /> copy</button><button onClick={exportAnswer}><Download size={13} /> TXT</button><button onClick={() => exportPdf(activeQuery, generationModel)}><FileText size={13} /> PDF</button></div>}</div>{activeQuery?.answer ? <article className="answer-copy"><div className="answer-status"><StatusDot tone={activeQuery.status === "insufficient" ? "warn" : "ready"} /><span>{activeQuery.status === "insufficient" ? "Evidence may be insufficient" : "Answer generated from retrieved evidence"}</span><span className="mono">{formatMs(activeQuery.timings.totalMs)} total</span></div><p>{activeQuery.answer}</p></article> : <EmptyState icon={Sparkles} title="The answer will land here" body="Evidence is assembled first. The generation model only receives the retrieved passages shown above." />}</div>
        <aside className="inspector-column">{selectedChunk ? <><div className="inspector-heading"><span className="eyebrow">SELECTED CHUNK</span><span className="mono">{selectedChunk.id}</span></div><h3>{selectedChunk.sourceName}</h3><p className="inspector-location">{selectedChunk.location} · {selectedChunk.charCount} chars</p><div className="chunk-text">{selectedChunk.text}</div><div className="inspector-meta"><span><Layers3 size={13} /> {selectedChunk.embeddingDimension ? `${selectedChunk.embeddingDimension}D vector` : "not embedded"}</span><span><Gauge size={13} /> {selectedChunk.embeddingDimension ? "indexed" : "extracted only"}</span></div></> : <><div className="inspector-heading"><span className="eyebrow">INSPECTION</span><span className="mono">IDLE</span></div><EmptyState icon={FileCode2} title="Select a chunk" body="Hover a point or choose a result to inspect its source text and metadata." /></>}</aside>
      </section>

      <footer className="lab-footer"><span>RAG QUANTUM LAB / evidence before assertion</span><span><Database size={12} /> {readyDocuments} ready sources · {indexedCount} indexed chunks · cosine similarity · PCA projection</span></footer>
    </div>
  );
}
