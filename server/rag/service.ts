import { nanoid } from "nanoid";
import type {
  ChunkRecord,
  Citation,
  DocumentRecord,
  IngestFileInput,
  IngestResult,
  PipelineStage,
  ProjectedPoint,
  QueryRecord,
  QueryResult,
  RetrievalCandidate,
  PipelineProgressEvent,
  WorkspaceSnapshot,
} from "@shared/types";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 780;
const DEFAULT_OVERLAP = 120;
const DEFAULT_TOP_K = 5;

 type InternalChunk = ChunkRecord & { embedding?: number[]; projection?: [number, number, number] };
 type Workspace = {
  documents: DocumentRecord[];
  chunks: InternalChunk[];
  queries: QueryRecord[];
  embeddingModel?: string;
  projection?: PcaModel;
};

type PcaModel = {
  mean: number[];
  components: number[][];
};

const workspaces = new Map<string, Workspace>();
const progressListeners = new Map<string, Set<(event: PipelineProgressEvent) => void>>();

export function subscribeToProgress(workspaceId: string, listener: (event: PipelineProgressEvent) => void) {
  const listeners = progressListeners.get(workspaceId) || new Set();
  listeners.add(listener);
  progressListeners.set(workspaceId, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) progressListeners.delete(workspaceId);
  };
}

function publishProgress(event: PipelineProgressEvent) {
  progressListeners.get(event.workspaceId)?.forEach(listener => listener(event));
}

function getWorkspace(workspaceId: string): Workspace {
  const existing = workspaces.get(workspaceId);
  if (existing) return existing;
  const workspace: Workspace = { documents: [], chunks: [], queries: [] };
  workspaces.set(workspaceId, workspace);
  return workspace;
}

function now() {
  return new Date().toISOString();
}

function cleanModelName(model: string | undefined, fallback: string) {
  const value = (model || fallback).trim();
  return value.replace(/^models\//, "");
}

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

function normalizeText(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(file: IngestFileInput): Promise<{ text: string; location: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.contentBase64) || file.contentBase64.length % 4 === 1) {
    throw new Error("The uploaded payload is not valid base64.");
  }
  const buffer = Buffer.from(file.contentBase64, "base64");
  if (buffer.length !== file.size) throw new Error("The uploaded byte count did not match its declared size.");
  if (buffer.length > MAX_FILE_BYTES) throw new Error(`File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`);
  const extension = extensionOf(file.name);

  if (["txt", "md", "markdown", "csv", "json", "html", "htm", "xml", "js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "css", "scss", "yml", "yaml", "sql", "env"].includes(extension)) {
    return { text: normalizeText(buffer.toString("utf8")), location: "document" };
  }

  if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return { text: normalizeText(result.text), location: "PDF text layer" };
  }

  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalizeText(result.value), location: "DOCX body" };
  }

  if (["xlsx", "xls"].includes(extension)) {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      return `## Sheet: ${sheetName}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    });
    return { text: normalizeText(sheets.join("\n\n")), location: "workbook sheets" };
  }

  throw new Error(`Unsupported format .${extension || "unknown"}. Supported in this build: TXT, Markdown, CSV, JSON, HTML, XML, source/config files, PDF text layers, DOCX, XLSX.`);
}

function chunkText(text: string, documentId: string, sourceName: string, location: string, size = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP): InternalChunk[] {
  const safeSize = Math.max(160, Math.min(size, 4000));
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeSize / 2)));
  if (!text) return [];
  const chunks: InternalChunk[] = [];
  let cursor = 0;
  let index = 0;
  while (cursor < text.length) {
    const end = Math.min(text.length, cursor + safeSize);
    const raw = text.slice(cursor, end).trim();
    if (raw) {
      chunks.push({
        id: `${documentId}-c${String(index + 1).padStart(3, "0")}`,
        documentId,
        sourceName,
        location: `${location} · chars ${cursor + 1}-${end}`,
        text: raw,
        charCount: raw.length,
      });
      index += 1;
    }
    if (end >= text.length) break;
    cursor = Math.max(cursor + 1, end - safeOverlap);
  }
  return chunks;
}

async function geminiEmbed(apiKey: string, model: string, text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ content: { parts: [{ text }] }, taskType }),
  });
  if (!response.ok) {
    throw new Error(`Embedding provider rejected the request (${response.status}). Check the key, model, quota, or network connection.`);
  }
  const data = await response.json() as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values?.length) throw new Error("Embedding provider returned no vector values.");
  return values;
}

async function geminiGenerate(apiKey: string, model: string, question: string, results: RetrievalCandidate[]): Promise<string> {
  const evidence = results.map(result => `[${result.id}] rank=${result.rank} similarity=${result.score.toFixed(4)} source=${result.sourceName} location=${result.location}\n${result.text}`).join("\n\n");
  const prompt = [
    "You are the grounded generation stage of an academic RAG laboratory. The evidence blocks below are the only source of truth for this answer.",
    "Read and compare every supplied evidence block before answering. Synthesize the answer from those chunks; do not answer from general knowledge, assumptions, or the similarity score.",
    "Every factual claim must be followed by one or more source IDs in square brackets, for example [doc-c001]. Never invent a source ID or citation.",
    "If the chunks do not directly support the question, say exactly: 'The indexed evidence is insufficient to answer this reliably.' Then briefly state what is missing.",
    "Be concise but complete. Distinguish explicit evidence from a cautious inference, and label any inference as such.",
    `Question: ${question}`,
    "Evidence:",
    evidence || "(No evidence retrieved.)",
  ].join("\n\n");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  if (!response.ok) {
    throw new Error(`Generation provider rejected the request (${response.status}). Check the key, model, quota, or network connection.`);
  }
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!answer) throw new Error("Generation provider returned an empty answer.");
  return answer;
}

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) total += a[i] * b[i];
  return total;
}

function magnitude(vector: number[]) {
  return Math.sqrt(dot(vector, vector)) || 1;
}

function cosineSimilarity(a: number[], b: number[]) {
  return dot(a, b) / (magnitude(a) * magnitude(b));
}

function subtract(a: number[], b: number[]) {
  return a.map((value, index) => value - (b[index] || 0));
}

function normalize(vector: number[]) {
  const length = magnitude(vector);
  return vector.map(value => value / length);
}

function fitPca(vectors: number[][]): PcaModel | undefined {
  if (!vectors.length) return undefined;
  const dimension = vectors[0].length;
  const mean = Array.from({ length: dimension }, (_, index) => vectors.reduce((sum, vector) => sum + (vector[index] || 0), 0) / vectors.length);
  const centered = vectors.map(vector => subtract(vector, mean));
  const components: number[][] = [];

  for (let componentIndex = 0; componentIndex < 3; componentIndex += 1) {
    let direction = normalize(Array.from({ length: dimension }, (_, index) => Math.sin((index + 1) * (componentIndex + 1) * 1.37)));
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const next = Array.from({ length: dimension }, () => 0);
      for (const vector of centered) {
        const scale = dot(vector, direction);
        for (let index = 0; index < dimension; index += 1) next[index] += vector[index] * scale;
      }
      for (const previous of components) {
        const projection = dot(next, previous);
        for (let index = 0; index < dimension; index += 1) next[index] -= projection * previous[index];
      }
      direction = normalize(next);
    }
    components.push(direction);
  }
  return { mean, components };
}

function applyPca(vector: number[], model: PcaModel): [number, number, number] {
  const centered = subtract(vector, model.mean);
  const raw = model.components.map(component => dot(centered, component));
  const scale = Math.max(1, ...raw.map(value => Math.abs(value)));
  return [raw[0] / scale, raw[1] / scale, raw[2] / scale];
}

function toSnapshot(workspaceId: string, workspace: Workspace): WorkspaceSnapshot {
  const indexed = workspace.chunks.filter(chunk => chunk.embedding);
  const dimensions = indexed[0]?.embedding?.length;
  return {
    workspaceId,
    documents: workspace.documents,
    chunks: workspace.chunks.map(({ embedding, projection, ...chunk }) => ({ ...chunk, embeddingDimension: embedding?.length })),
    points: indexed.map(chunk => {
      const projection = chunk.projection || [0, 0, 0];
      return { chunkId: chunk.id, documentId: chunk.documentId, sourceName: chunk.sourceName, location: chunk.location, excerpt: chunk.text.slice(0, 180), x: projection[0], y: projection[1], z: projection[2] } satisfies ProjectedPoint;
    }),
    queries: workspace.queries,
    index: {
      status: indexed.length ? "ready" : workspace.chunks.length ? "extracted" : "empty",
      embeddingModel: workspace.embeddingModel,
      dimension: dimensions,
      metric: "cosine_similarity",
      projection: "PCA",
    },
  };
}

function event(workspaceId: string, operationId: string, documentId: string, stage: PipelineStage, message: string, progress?: { current?: number; total?: number }) {
  const payload: PipelineProgressEvent = {
    workspaceId,
    operationId,
    documentId,
    stage,
    message,
    ...progress,
    ...(progress?.current !== undefined && progress?.total ? { percentage: Math.round((progress.current / progress.total) * 100) } : {}),
    at: now(),
  };
  publishProgress(payload);
  return payload;
}

function configuredGeminiKey(override?: string) {
  const key = override?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("No Gemini API key is configured for this project.");
  return key;
}

export async function snapshotWorkspace(workspaceId: string) {
  return toSnapshot(workspaceId, getWorkspace(workspaceId));
}

export async function ingestFiles(input: {
  workspaceId: string;
  files: IngestFileInput[];
  apiKey?: string | null;
  embeddingModel?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IngestResult> {
  const totalBytes = input.files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 25 * 1024 * 1024) throw new Error("The combined upload exceeds the 25 MB session limit.");
  const workspace = getWorkspace(input.workspaceId);
  const operationId = nanoid(12);
  const events: IngestResult["events"] = [];
  const embeddingModel = cleanModelName(input.embeddingModel, "gemini-embedding-001");
  const apiKey = input.apiKey === null ? undefined : input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (apiKey) workspace.embeddingModel = embeddingModel;

  for (const file of input.files) {
    const documentId = nanoid(10);
    const duplicate = workspace.documents.some(document => document.name === file.name && document.size === file.size);
    const document: DocumentRecord = {
      id: documentId,
      name: file.name,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size,
      status: "processing",
      stage: "validating",
      extractedChars: 0,
      chunkCount: 0,
      indexedChunkCount: 0,
      createdAt: now(),
    };
    workspace.documents.unshift(document);
    events.push(event(input.workspaceId, operationId, documentId, "validating", `Validated ${file.name}`, { current: 0, total: input.files.length }));
    try {
      if (duplicate) throw new Error("This filename and byte size already exist in the session.");
      document.stage = "extracting";
      events.push(event(input.workspaceId, operationId, documentId, "extracting", `Extracting content from ${file.name}`));
      const extracted = await extractText(file);
      if (!extracted.text) throw new Error("No text was extracted from this file.");
      document.extractedChars = extracted.text.length;
      events.push(event(input.workspaceId, operationId, documentId, "extracting", `Extracted ${extracted.text.length.toLocaleString()} characters from ${file.name}`));
      document.stage = "chunking";
      events.push(event(input.workspaceId, operationId, documentId, "chunking", "Creating deterministic chunks with source offsets"));
      const chunks = chunkText(extracted.text, documentId, file.name, extracted.location, input.chunkSize, input.overlap);
      if (!chunks.length) throw new Error("The extracted document produced no non-empty chunks.");
      document.chunkCount = chunks.length;
      events.push(event(input.workspaceId, operationId, documentId, "chunking", `Created ${chunks.length} deterministic chunks`, { current: chunks.length, total: chunks.length }));
      if (apiKey) {
        document.stage = "embedding";
        events.push(event(input.workspaceId, operationId, documentId, "embedding", `Embedding 0/${chunks.length} chunks with ${embeddingModel}`, { current: 0, total: chunks.length }));
        const started = Date.now();
        for (const [index, chunk] of chunks.entries()) {
          chunk.embedding = await geminiEmbed(apiKey, embeddingModel, chunk.text, "RETRIEVAL_DOCUMENT");
          events.push(event(input.workspaceId, operationId, documentId, "embedding", `Embedded chunk ${index + 1}/${chunks.length}`, { current: index + 1, total: chunks.length }));
        }
        const existingDimension = workspace.chunks.find(chunk => chunk.embedding)?.embedding?.length;
        const nextDimension = chunks[0]?.embedding?.length;
        if (existingDimension && nextDimension && existingDimension !== nextDimension) {
          throw new Error(`Embedding dimension mismatch: index uses ${existingDimension} dimensions but this model returned ${nextDimension}.`);
        }
        workspace.chunks.push(...chunks);
        document.indexedChunkCount = chunks.length;
        document.stage = "indexing";
        events.push(event(input.workspaceId, operationId, documentId, "indexing", `Indexed ${chunks.length} real vectors in ${Date.now() - started} ms`, { current: chunks.length, total: chunks.length }));
      } else {
        workspace.chunks.push(...chunks);
        document.stage = "ready";
        document.status = "extracted";
        events.push(event(input.workspaceId, operationId, documentId, "ready", "Chunks ready; add a Gemini key to generate embeddings and index vectors"));
      }
      document.stage = "ready";
      document.status = apiKey ? "ready" : "extracted";
      events.push(event(input.workspaceId, operationId, documentId, "ready", `${document.chunkCount} chunks available for inspection`, { current: document.chunkCount, total: document.chunkCount }));
    } catch (error) {
      document.status = "error";
      document.stage = "error";
      document.error = error instanceof Error ? error.message : "Document processing failed.";
      events.push(event(input.workspaceId, operationId, documentId, "error", document.error));
    }
  }

  const indexed = workspace.chunks.filter(chunk => chunk.embedding);
  if (indexed.length) {
    workspace.projection = fitPca(indexed.map(chunk => chunk.embedding!));
    indexed.forEach(chunk => { chunk.projection = applyPca(chunk.embedding!, workspace.projection!); });
  }

  return { snapshot: toSnapshot(input.workspaceId, workspace), operationId, events };
}

export async function queryWorkspace(input: {
  workspaceId: string;
  question: string;
  apiKey?: string;
  generationModel?: string;
  embeddingModel?: string;
  topK?: number;
}): Promise<QueryResult> {
  const workspace = getWorkspace(input.workspaceId);
  const apiKey = configuredGeminiKey(input.apiKey);
  const started = Date.now();
  const question = input.question.trim();
  if (!question) throw new Error("Enter a question before retrieving evidence.");
  const indexed = workspace.chunks.filter(chunk => chunk.embedding);
  if (!indexed.length) throw new Error("No indexed vectors are available. Add a Gemini key and process a document first.");

  const embeddingStarted = Date.now();
  const model = cleanModelName(input.embeddingModel || workspace.embeddingModel, "gemini-embedding-001");
  if (workspace.embeddingModel && model !== workspace.embeddingModel) {
    throw new Error(`Embedding model mismatch: this index uses ${workspace.embeddingModel}. Reprocess the sources before querying with ${model}.`);
  }
  const queryEmbedding = await geminiEmbed(apiKey, model, question, "RETRIEVAL_QUERY");
  const queryEmbeddingMs = Date.now() - embeddingStarted;
  const indexDimension = indexed[0]?.embedding?.length;
  if (indexDimension && queryEmbedding.length !== indexDimension) {
    throw new Error(`Embedding dimension mismatch: this index uses ${indexDimension} dimensions but the query returned ${queryEmbedding.length}.`);
  }
  if (!workspace.projection) {
    workspace.projection = fitPca(indexed.map(chunk => chunk.embedding!));
    indexed.forEach(chunk => { chunk.projection = applyPca(chunk.embedding!, workspace.projection!); });
  }

  const retrievalStarted = Date.now();
  const ranked = indexed
    .map(chunk => ({ ...chunk, rank: 0, score: cosineSimilarity(queryEmbedding, chunk.embedding!), metric: "cosine_similarity" as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(input.topK || DEFAULT_TOP_K, 10)))
    .map((result, index) => ({ ...result, rank: index + 1 }));
  const results: RetrievalCandidate[] = ranked.map(({ embedding, projection, ...result }) => result);
  const retrievalMs = Date.now() - retrievalStarted;
  const generationStarted = Date.now();
  let answer: string;
  let status: QueryRecord["status"] = "complete";
  try {
    answer = await geminiGenerate(apiKey, cleanModelName(input.generationModel, "gemini-3.5-flash"), question, results);
    if (results.length === 0 || results[0].score < 0.2) status = "insufficient";
  } catch (error) {
    const query: QueryRecord = {
      id: nanoid(10), question, createdAt: now(), status: "error", citations: [], results,
      queryProjection: applyPca(queryEmbedding, workspace.projection!), timings: { queryEmbeddingMs, retrievalMs, generationMs: Date.now() - generationStarted, totalMs: Date.now() - started }, error: error instanceof Error ? error.message : "Generation failed.",
    };
    workspace.queries.unshift(query);
    throw new Error(query.error);
  }
  const generationMs = Date.now() - generationStarted;
  const citations: Citation[] = results.map(result => ({ chunkId: result.id, sourceName: result.sourceName, location: result.location, quote: result.text.slice(0, 220) }));
  const query: QueryRecord = {
    id: nanoid(10), question, createdAt: now(), status, answer, citations,
    results,
    queryProjection: applyPca(queryEmbedding, workspace.projection!),
    timings: { queryEmbeddingMs, retrievalMs, generationMs, totalMs: Date.now() - started },
  };
  workspace.queries.unshift(query);
  return { snapshot: toSnapshot(input.workspaceId, workspace), query };
}

export async function indexExtractedChunks(input: { workspaceId: string; apiKey?: string; embeddingModel?: string }): Promise<IngestResult> {
  const workspace = getWorkspace(input.workspaceId);
  const operationId = nanoid(12);
  const apiKey = configuredGeminiKey(input.apiKey);
  const model = cleanModelName(input.embeddingModel || workspace.embeddingModel, "gemini-embedding-001");
  const pending = workspace.chunks.filter(chunk => !chunk.embedding);
  const events: IngestResult["events"] = [];
  if (!pending.length) return { snapshot: toSnapshot(input.workspaceId, workspace), operationId, events };
  const embedded: Array<{ chunk: InternalChunk; vector: number[] }> = [];
  try {
    for (const [index, chunk] of pending.entries()) {
      const vector = await geminiEmbed(apiKey, model, chunk.text, "RETRIEVAL_DOCUMENT");
      embedded.push({ chunk, vector });
      events.push(event(input.workspaceId, operationId, chunk.documentId, "embedding", `Embedded extracted chunk ${index + 1}/${pending.length}`, { current: index + 1, total: pending.length }));
    }
    const existingDimension = workspace.chunks.find(chunk => chunk.embedding)?.embedding?.length;
    const nextDimension = embedded[0]?.vector.length;
    if (existingDimension && nextDimension && existingDimension !== nextDimension) {
      throw new Error(`Embedding dimension mismatch: index uses ${existingDimension} dimensions but this model returned ${nextDimension}.`);
    }
    workspace.embeddingModel = model;
    embedded.forEach(({ chunk, vector }) => { chunk.embedding = vector; });
    const byDocument = new Map<string, number>();
    embedded.forEach(({ chunk }) => byDocument.set(chunk.documentId, (byDocument.get(chunk.documentId) || 0) + 1));
    workspace.documents.forEach(document => {
      const count = byDocument.get(document.id);
      if (!count) return;
      document.status = "ready";
      document.stage = "ready";
      document.indexedChunkCount = document.chunkCount;
      events.push(event(input.workspaceId, operationId, document.id, "indexing", `Indexed ${count} extracted chunks with ${model}`, { current: document.indexedChunkCount, total: document.chunkCount }));
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Indexing extracted chunks failed.");
  }
  const indexed = workspace.chunks.filter(chunk => chunk.embedding);
  workspace.projection = fitPca(indexed.map(chunk => chunk.embedding!));
  indexed.forEach(chunk => { chunk.projection = applyPca(chunk.embedding!, workspace.projection!); });
  return { snapshot: toSnapshot(input.workspaceId, workspace), operationId, events };
}

export function removeDocument(workspaceId: string, documentId: string) {
  const workspace = getWorkspace(workspaceId);
  workspace.documents = workspace.documents.filter(document => document.id !== documentId);
  workspace.chunks = workspace.chunks.filter(chunk => chunk.documentId !== documentId);
  workspace.queries = workspace.queries.map(query => ({ ...query, results: query.results.filter(result => result.documentId !== documentId), citations: query.citations.filter(citation => !citation.chunkId.startsWith(`${documentId}-`)) }));
  const indexed = workspace.chunks.filter(chunk => chunk.embedding);
  workspace.projection = indexed.length ? fitPca(indexed.map(chunk => chunk.embedding!)) : undefined;
  indexed.forEach(chunk => { chunk.projection = applyPca(chunk.embedding!, workspace.projection!); });
  return toSnapshot(workspaceId, workspace);
}
