# RAG Quantum Lab

RAG Quantum Lab is an academic RAG observatory built on React, Three.js/React Three Fiber, Express, tRPC, and TypeScript. The interface opens directly into the working laboratory: source ingestion on the left, a 3D embedding universe in the center, and query/evidence/answer inspection on the right.

## Run locally

```bash
pnpm install
pnpm dev
```

The development server honors `PORT` and defaults to `3000`. The production path is:

```bash
pnpm build
pnpm start
```

Useful checks are `pnpm check` for TypeScript and `pnpm test` for the existing Vitest suite.

## Current pipeline

The server performs real format detection, extraction, deterministic chunking, and source metadata capture. With a Gemini API key configured in the session UI, it sends chunks to the configured embedding model, stores the returned vectors in the session workspace, computes a deterministic PCA-style 3D projection using power iteration for visualization, ranks query results with cosine similarity over the original vectors, and sends the actual top-k evidence to the configured generation model. The client never receives raw embeddings or persists the key.

If a document is extracted before a key is configured, the source register exposes an explicit re-index action after the key is entered. Provider errors are surfaced as actionable status messages without echoing provider response bodies.

## Supported formats in this build

TXT, Markdown, CSV, JSON, HTML, XML, common source/config files, PDF text layers, DOCX raw text, and XLS/XLSX sheets. Scanned-PDF OCR, PPTX, claim-level citation verification, and alternative retrieval experiments are not claimed yet. Unsupported or empty files remain visible as errors instead of being treated as successful ingestion.

## Session and privacy behavior

The current workspace is keyed by a browser session identifier and stored in server memory. It is intentionally not durable yet; a server restart clears documents, chunks, vectors, and query history. The Gemini key is held in React memory and sent only to the server for the current operation using a request header; it is not stored in browser storage, URLs, logs, or exports. The current public workspace procedures are suitable for a single-user capstone preview, not a multi-tenant deployment; authentication and server-enforced workspace ownership remain hardening work.

## Project files

- `client/src/pages/Home.tsx` — laboratory shell and interactions.
- `client/src/components/scene/EmbeddingUniverse.tsx` — actual chunk-point visualization and query marker.
- `server/rag/service.ts` — extraction, chunking, Gemini boundaries, PCA projection, retrieval, generation, re-indexing, and deletion.
- `server/routers.ts` — typed RAG procedures.
- `plan.md` — architecture and design decisions.
- `TODO.md` — outcome-based delivery requirements.

Do not put provider keys in `.env`, source control, or exported reports unless you explicitly intend them to be server-managed deployment secrets. The browser configuration endpoint exposes only named public runtime values.
