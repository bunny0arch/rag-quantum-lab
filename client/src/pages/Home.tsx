import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { jsPDF } from "jspdf";
import { AlertCircle, Archive, ArrowDown, Check, ChevronDown, Clipboard, Database, Download, FileText, Gauge, KeyRound, Layers3, Loader2, Orbit, RefreshCw, Search, Settings2, SlidersHorizontal, Trash2, UploadCloud, X } from "lucide-react";
import { AdaptiveNav } from "@/components/ui/AdaptiveNav";
import { trpc } from "@/lib/trpc";
import type { DocumentRecord, ProjectedPoint, QueryRecord, WorkspaceSnapshot } from "@shared/types";

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
const stageText = (stage: DocumentRecord["stage"]) => ({ queued: "queued", validating: "validating", extracting: "extracting", chunking: "chunking", embedding: "embedding", indexing: "indexing", ready: "ready", error: "error" })[stage];
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
  let y = 104;
  const writeBlock = (text: string, size = 10, gap = 18) => {
    document.setFontSize(size);
    const lines = document.splitTextToSize(text, width);
    if (y + lines.length * 14 > 760) { document.addPage(); y = 54; }
    document.text(lines, margin, y);
    y += lines.length * 14 + gap;
  };
  document.setFont("helvetica", "bold"); document.setFontSize(11); document.text("Question", margin, y); y += 18;
  document.setFont("helvetica", "normal"); writeBlock(query.question, 10, 22);
  document.setFont("helvetica", "bold"); document.text("Grounded answer", margin, y); y += 18;
  document.setFont("helvetica", "normal"); writeBlock(query.answer || "No answer returned.", 10, 20);
  document.setFont("helvetica", "bold"); document.text("Retrieved evidence", margin, y); y += 18;
  document.setFont("helvetica", "normal");
  query.citations.forEach(citation => writeBlock(`[${citation.chunkId}] ${citation.sourceName} · ${citation.location}\n${citation.quote}`, 9, 14));
  document.setFontSize(8); document.setTextColor(105, 111, 111);
  document.text(`Query embedding ${formatMs(query.timings.queryEmbeddingMs)} · Retrieval ${formatMs(query.timings.retrievalMs)} · Generation ${formatMs(query.timings.generationMs)} · Total ${formatMs(query.timings.totalMs)}`, margin, 790);
  document.save(`rag-quantum-${query.id}.pdf`);
}

function StatusDot({ tone = "neutral" }: { tone?: "ready" | "warn" | "error" | "neutral" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Archive; title: string; body: string }) {
  return <div className="empty-state"><Icon size={17} strokeWidth={1.4} /><strong>{title}</strong><p>{body}</p></div>;
}

const stages = [
  { key: "extract", label: "extract" },
  { key: "chunk", label: "chunk" },
  { key: "embed", label: "embed" },
  { key: "index", label: "index" },
  { key: "retrieve", label: "retrieve" },
  { key: "answer", label: "answer" },
] as const;

export default function Home() {
  const [workspaceId] = useState(defaultWorkspaceId);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
  const [embeddingModel, setEmbeddingModel] = useState("gemini-embedding-001");
  const [generationModel, setGenerationModel] = useState("qwen/qwen-2.5-72b-instruct");
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
  const [sourceDockOpen, setSourceDockOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("universe");
  const [localError, setLocalError] = useState("");
  const [lastEvent, setLastEvent] = useState("");

  useEffect(() => {
    const source = new EventSource(`/api/rag/progress?workspaceId=${encodeURIComponent(workspaceId)}`);
    source.addEventListener("progress", event => {
      try {
        const progress = JSON.parse((event as MessageEvent).data) as { message?: string };
        if (progress.message) setLastEvent(progress.message);
      } catch {
        // Ignore malformed progress frames; the completed mutation remains authoritative.
      }
    });
    return () => source.close();
  }, [workspaceId]);

  const snapshotQuery = trpc.rag.snapshot.useQuery({ workspaceId }, { refetchOnWindowFocus: false });
  const ingestMutation = trpc.rag.ingest.useMutation({ onMutate: () => { setLastEvent("Upload accepted; streaming extraction progress"); }, onSuccess: result => { setSnapshot(result.snapshot); setLastEvent(result.events.at(-1)?.message || "Pipeline event received"); setSourceDockOpen(false); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const indexMutation = trpc.rag.indexExtracted.useMutation({ onMutate: () => { setLastEvent("Re-index accepted; streaming embedding progress"); }, onSuccess: result => { setSnapshot(result.snapshot); setLastEvent(result.events.at(-1)?.message || "Extracted chunks indexed"); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const queryMutation = trpc.rag.query.useMutation({ onMutate: () => { setEvidenceOpen(false); }, onSuccess: result => { setSnapshot(result.snapshot); setActiveQueryId(result.query.id); setEvidenceOpen(true); setLastEvent(result.query.status === "insufficient" ? "Generation returned with insufficient evidence" : "Grounded answer returned from selected evidence"); setLocalError(""); }, onError: error => setLocalError(error.message) });
  const removeMutation = trpc.rag.removeDocument.useMutation({ onSuccess: result => { setSnapshot(result); setSelectedChunkId(undefined); } });

  useEffect(() => { if (snapshotQuery.data && !snapshot) setSnapshot(snapshotQuery.data); }, [snapshot, snapshotQuery.data]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveNav(visible.target.id);
    }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.3, 0.7] });
    ["sources", "universe", "retrieval", "method"].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);

  const current = snapshot || snapshotQuery.data;
  const activeQuery = queryMutation.isPending ? undefined : current?.queries.find(queryRecord => queryRecord.id === activeQueryId) || current?.queries[0];
  const selectedChunk = current?.chunks.find(chunk => chunk.id === selectedChunkId);
  const highlightedIds = useMemo(() => new Set(activeQuery?.results.map(result => result.id) || []), [activeQuery]);
  const indexedCount = current?.points.length || 0;
  const extractedDocuments = current?.documents.filter(document => document.status === "extracted").length || 0;
  const readyDocuments = current?.documents.filter(document => document.status === "ready").length || 0;
  const isBusy = ingestMutation.isPending || indexMutation.isPending || queryMutation.isPending;
  const operation = queryMutation.isPending ? "query" : (ingestMutation.isPending || indexMutation.isPending) ? "ingest" : activeQuery ? "answer" : indexedCount ? "ready" : current?.chunks.length ? "extracted" : "idle";
  const currentTone = localError ? "error" : isBusy ? "warn" : indexedCount ? "ready" : current?.chunks.length ? "warn" : "neutral";
  const ingestFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setLocalError("");
    try {
      const encoded = await Promise.all(files.slice(0, 12).map(encodeFile));
      ingestMutation.mutate({ workspaceId, files: encoded, embeddingModel, chunkSize, overlap });
    } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not read the selected files."); }
  }, [chunkSize, embeddingModel, ingestMutation, overlap, workspaceId]);

  const handleQuery = () => {
    queryMutation.mutate({ workspaceId, question, embeddingModel, generationModel, topK });
  };

  const copy = async (content: string) => {
    try { await navigator.clipboard.writeText(content); setLocalError(""); } catch { setLocalError("Clipboard access was unavailable in this browser."); }
  };

  const exportAnswer = () => {
    if (!activeQuery) return;
    const citations = activeQuery.citations.map(citation => `[${citation.chunkId}] ${citation.sourceName} · ${citation.location}\n${citation.quote}`).join("\n\n");
    downloadText(`rag-quantum-${activeQuery.id}.txt`, `RAG QUANTUM LAB\n\nQUESTION\n${activeQuery.question}\n\nANSWER\n${activeQuery.answer || "No answer returned."}\n\nCITATIONS\n${citations}\n\nTIMINGS\nQuery embedding: ${formatMs(activeQuery.timings.queryEmbeddingMs)}\nRetrieval: ${formatMs(activeQuery.timings.retrievalMs)}\nGeneration: ${formatMs(activeQuery.timings.generationMs)}\nTotal: ${formatMs(activeQuery.timings.totalMs)}`);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const x = (event.clientX - window.innerWidth / 2) * 0.018;
    const y = (event.clientY - window.innerHeight / 2) * 0.012;
    document.documentElement.style.setProperty("--parallax-x", `${x.toFixed(2)}px`);
    document.documentElement.style.setProperty("--parallax-y", `${y.toFixed(2)}px`);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); void ingestFiles(Array.from(event.dataTransfer.files)); };
  const stageDone = (key: typeof stages[number]["key"]) => key === "extract" || key === "chunk" ? Boolean(current?.chunks.length) : key === "embed" || key === "index" ? indexedCount > 0 : key === "retrieve" ? Boolean(activeQuery) : Boolean(activeQuery?.answer);
  const stageActive = (key: typeof stages[number]["key"]) => (isBusy && ((operation === "query" && (key === "retrieve" || key === "answer")) || (operation === "ingest" && (key === "embed" || key === "index")))) || (operation === "answer" && key === "answer");

  return (
    <div className="lab-shell lab-shell--immersive" onPointerMove={handlePointerMove}>
      <div className="scene-viewport" aria-hidden="true">
        <Suspense fallback={<div className="scene-loading">INITIALIZING VECTOR FIELD</div>}><EmbeddingUniverse points={current?.points || []} queryProjection={activeQuery?.queryProjection} highlightedIds={highlightedIds} selectedId={selectedChunkId} onSelect={point => setSelectedChunkId(point.chunkId)} onHover={setHoveredPoint} resetToken={resetToken} fitToken={fitToken} reducedMotion={window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false} /></Suspense>
        <div className="scene-vignette" />
        <div className="scene-gridline" />
      </div>

      <header className="floating-topbar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /></div><div><div className="brand-name">RAG QUANTUM LAB</div><div className="brand-subtitle">retrieval observatory / live session</div></div></div>
        <AdaptiveNav activeId={activeNav} />
        <div className="topbar-status"><StatusDot tone={currentTone} /><span>{isBusy ? "PROCESSING" : indexedCount ? "INDEX READY" : current?.chunks.length ? "EXTRACTED" : "AWAITING SOURCE"}</span><button className="icon-button" onClick={() => setSettingsOpen(value => !value)} aria-label="Open session configuration"><Settings2 size={15} /></button></div>
      </header>

      <main className="immersive-ui">
        <section id="sources" className={`source-dock ${sourceDockOpen ? "is-open" : "is-collapsed"}`} aria-label="Floating source register">
          <div className="dock-kicker"><span>01 / SOURCES</span><button onClick={() => setSourceDockOpen(value => !value)} aria-label={sourceDockOpen ? "Collapse sources" : "Expand sources"}>{sourceDockOpen ? <ChevronDown size={14} /> : <Archive size={14} />}</button></div>
          {sourceDockOpen ? <>
            <div className="floating-drop-zone" onDragOver={event => event.preventDefault()} onDrop={onDrop}><UploadCloud size={18} strokeWidth={1.4} /><strong>Drop source</strong><span>or <label htmlFor="file-input">select files</label></span><input id="file-input" type="file" multiple hidden accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.css,.scss,.yml,.yaml,.sql,.env,.pdf,.docx,.xlsx,.xls" onChange={event => { void ingestFiles(Array.from(event.target.files || [])); event.target.value = ""; }} /></div>
            <div className="source-dock__meta"><span>{current?.documents.length || 0} source{current?.documents.length === 1 ? "" : "s"}</span><span className="mono">{indexedCount} vectors</span></div>
            {current?.documents.length ? <div className="floating-source-list">{current.documents.slice(0, 4).map(document => <article className="floating-source-row" key={document.id}><span className={`source-state source-state--${document.status}`} /> <div><strong title={document.name}>{document.name}</strong><small>{stageText(document.stage)} · {document.chunkCount || "—"} chunks</small></div><button onClick={() => removeMutation.mutate({ workspaceId, documentId: document.id })} aria-label={`Remove ${document.name}`}><Trash2 size={12} /></button></article>)}</div> : <div className="source-empty"><Archive size={15} /><span>Sources become chunks, then vectors.</span></div>}
            {extractedDocuments > 0 && <button className="floating-index-button" disabled={indexMutation.isPending} onClick={() => indexMutation.mutate({ workspaceId, embeddingModel })}>{indexMutation.isPending ? <Loader2 size={12} className="spin" /> : <Database size={12} />} index {extractedDocuments} extracted</button>}
          </> : <button className="source-collapsed-button" onClick={() => setSourceDockOpen(true)}><span className="source-count">{current?.documents.length || 0}</span><span>source register</span></button>}
        </section>

        <section id="universe" className="universe-readout" aria-label="Embedding universe readout"><span className="eyebrow">02 / VECTOR SPACE</span><strong>{indexedCount ? `${indexedCount} indexed point${indexedCount === 1 ? "" : "s"}` : "Awaiting indexed vectors"}</strong><span>PCA-style projection · cosine ranking stays in original space</span><div className="universe-readout__actions"><button onClick={() => setResetToken(value => value + 1)} title="Reset camera"><RefreshCw size={13} /></button><button onClick={() => setFitToken(value => value + 1)} disabled={!indexedCount} title="Fit all points"><Orbit size={13} /></button></div></section>

        <section className="floating-method" aria-label="Visualization method"><span className="mono">METHOD</span><span>HIGH-DIMENSIONAL EMBEDDINGS</span><span className="method-separator">→</span><span>3D PCA-STYLE VIEW</span></section>

        {hoveredPoint && <div className="floating-point-tooltip"><span className="mono">{hoveredPoint.chunkId}</span><strong>{hoveredPoint.sourceName}</strong><p>{hoveredPoint.excerpt}</p></div>}

        {selectedChunk && <aside className="chunk-inspector" aria-label="Selected chunk inspection"><div className="chunk-inspector__head"><span className="eyebrow">CHUNK INSPECTOR</span><button onClick={() => setSelectedChunkId(undefined)} aria-label="Close chunk inspector"><X size={13} /></button></div><strong>{selectedChunk.sourceName}</strong><span className="mono">{selectedChunk.id} · {selectedChunk.location}</span><p>{selectedChunk.text}</p><div className="chunk-inspector__meta"><span><Layers3 size={12} /> {selectedChunk.embeddingDimension ? `${selectedChunk.embeddingDimension}D vector` : "not embedded"}</span><span><Gauge size={12} /> {selectedChunk.charCount} chars</span></div></aside>}

        {settingsOpen && <aside className="floating-config" aria-label="Session configuration"><div className="floating-config__head"><span><KeyRound size={13} /> MANAGED SESSION CONFIGURATION</span><button onClick={() => setSettingsOpen(false)} aria-label="Close configuration"><X size={14} /></button></div><div className="managed-key-status"><span className="status-dot status-dot--ready" /><span>Provider credentials active on the server</span></div><div className="config-grid"><label>Embedding model<input value={embeddingModel} onChange={event => setEmbeddingModel(event.target.value)} /></label><label>Generation model<input value={generationModel} onChange={event => setGenerationModel(event.target.value)} /></label><label>Chunk size<input type="number" min={160} max={4000} value={chunkSize} onChange={event => setChunkSize(Number(event.target.value) || 780)} /></label><label>Overlap<input type="number" min={0} max={2000} value={overlap} onChange={event => setOverlap(Number(event.target.value) || 0)} /></label></div><p>Provider credentials are managed server secrets. They are never sent from the browser, displayed, exported, or written to source files.</p></aside>}

        {localError && <div className="floating-error"><AlertCircle size={14} /><span>{localError}</span><button onClick={() => setLocalError("")} aria-label="Dismiss error"><X size={13} /></button></div>}

        <section id="retrieval" className={`evidence-float ${evidenceOpen && activeQuery ? "is-open" : "is-hidden"}`} aria-label="Retrieved evidence and answer">
          {activeQuery && <><div className="evidence-float__head"><div><span className="eyebrow">03 / EVIDENCE TRACE</span><strong>{activeQuery.results.length} candidates · {formatMs(activeQuery.timings.totalMs)} total</strong></div><button onClick={() => setEvidenceOpen(false)} aria-label="Close evidence"><X size={14} /></button></div><div className="evidence-float__question">{activeQuery.question}</div><div className="floating-results">{activeQuery.results.map(result => <button className={`floating-result ${selectedChunkId === result.id ? "is-selected" : ""}`} key={result.id} onClick={() => setSelectedChunkId(result.id)}><span className="floating-result__rank">{String(result.rank).padStart(2, "0")}</span><span><strong>{result.sourceName}</strong><small>{result.location}</small><p>{result.text.slice(0, 135)}{result.text.length > 135 ? "…" : ""}</p></span><b>{result.score.toFixed(3)}</b></button>)}</div><div className="answer-float"><div className="answer-float__status"><StatusDot tone={activeQuery.status === "insufficient" ? "warn" : "ready"} /><span>{activeQuery.status === "insufficient" ? "Insufficient evidence" : "Grounded answer"}</span><span className="mono">{formatMs(activeQuery.timings.generationMs)} generation</span></div><p>{activeQuery.answer || "No answer returned."}</p><div className="answer-float__actions"><button onClick={() => copy(activeQuery.answer || "")}><Clipboard size={12} /> copy</button><button onClick={exportAnswer}><Download size={12} /> TXT</button><button onClick={() => exportPdf(activeQuery, generationModel)}><FileText size={12} /> PDF</button></div></div><div className="query-history">{current?.queries.slice(0, 3).map(queryRecord => <button className={queryRecord.id === activeQuery.id ? "is-active" : ""} key={queryRecord.id} onClick={() => setActiveQueryId(queryRecord.id)}>{queryRecord.question.slice(0, 34)}{queryRecord.question.length > 34 ? "…" : ""}</button>)}</div></>}
        </section>

        <section id="method" className="pipeline-float" aria-label="RAG pipeline state"><div className="pipeline-float__head"><span className="eyebrow">LIVE PIPELINE</span><span className={`pipeline-operation ${isBusy ? "is-running" : ""}`}>{isBusy ? "awaiting server event" : lastEvent || "idle / no event"}</span></div><div className="pipeline-track">{stages.map((stage, index) => <div className={`pipeline-node ${stageDone(stage.key) ? "is-done" : ""} ${stageActive(stage.key) ? "is-running" : ""}`} key={stage.key}><span className="pipeline-node__marker">{stageDone(stage.key) ? <Check size={10} /> : String(index + 1).padStart(2, "0")}</span><span>{stage.label}</span>{index < stages.length - 1 && <i />}</div>)}</div></section>

        <section className="floating-query" aria-label="Query composer"><div className="floating-query__context"><span className="eyebrow">ASK THE INDEX</span><span className="mono">{indexedCount ? `${indexedCount} vectors available` : "no indexed vectors"}</span></div><div className="floating-query__input"><Search size={16} /><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey || event.altKey) && event.key === "Enter") handleQuery(); }} placeholder="Trace a question through the evidence field…" rows={1} /><button className="query-submit" onClick={handleQuery} disabled={queryMutation.isPending || !question.trim()}>{queryMutation.isPending ? <Loader2 size={15} className="spin" /> : <ArrowDown size={15} />} <span>retrieve</span></button></div><div className="floating-query__footer"><span className="mono">⌘↵ RUN QUERY</span><label><SlidersHorizontal size={12} /> top-k <input type="number" min={1} max={10} value={topK} onChange={event => setTopK(Number(event.target.value) || 1)} /></label>{activeQuery && !evidenceOpen && <button className="show-evidence" onClick={() => setEvidenceOpen(true)}>open evidence <ChevronDown size={12} /></button>}</div></section>
      </main>

      <footer className="floating-footer"><span>RAG QUANTUM LAB / evidence before assertion</span><span><Database size={12} /> {readyDocuments} ready sources · {indexedCount} indexed chunks · session memory</span></footer>
    </div>
  );
}
