import type { User, InsertUser } from "../drizzle/schema";
export type { User, InsertUser };
export * from "./_core/errors";

export type PipelineStage =
  | "queued"
  | "validating"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "error";

export type DocumentStatus = "processing" | "ready" | "extracted" | "error";

export type DocumentRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  stage: PipelineStage;
  extractedChars: number;
  chunkCount: number;
  indexedChunkCount: number;
  createdAt: string;
  error?: string;
};

export type ChunkRecord = {
  id: string;
  documentId: string;
  sourceName: string;
  location: string;
  text: string;
  charCount: number;
  embeddingDimension?: number;
};

export type ProjectedPoint = {
  chunkId: string;
  documentId: string;
  sourceName: string;
  location: string;
  excerpt: string;
  x: number;
  y: number;
  z: number;
};

export type RetrievalCandidate = ChunkRecord & {
  rank: number;
  score: number;
  metric: "cosine_similarity";
};

export type Citation = {
  chunkId: string;
  sourceName: string;
  location: string;
  quote: string;
};

export type QueryRecord = {
  id: string;
  question: string;
  createdAt: string;
  status: "complete" | "insufficient" | "error";
  answer?: string;
  citations: Citation[];
  results: RetrievalCandidate[];
  queryProjection?: [number, number, number];
  timings: {
    queryEmbeddingMs: number;
    retrievalMs: number;
    generationMs: number;
    totalMs: number;
  };
  error?: string;
};

export type WorkspaceSnapshot = {
  workspaceId: string;
  documents: DocumentRecord[];
  chunks: ChunkRecord[];
  points: ProjectedPoint[];
  queries: QueryRecord[];
  index: {
    status: "empty" | "extracted" | "ready";
    embeddingModel?: string;
    dimension?: number;
    metric: "cosine_similarity";
    projection: "PCA";
  };
};

export type IngestFileInput = {
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
};

export type PipelineProgressEvent = {
  operationId: string;
  workspaceId: string;
  documentId: string;
  stage: PipelineStage;
  message: string;
  current?: number;
  total?: number;
  percentage?: number;
  at: string;
};

export type IngestResult = {
  snapshot: WorkspaceSnapshot;
  operationId: string;
  events: PipelineProgressEvent[];
};

export type QueryResult = {
  snapshot: WorkspaceSnapshot;
  query: QueryRecord;
};
