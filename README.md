# RAG Quantum Lab

RAG Quantum Lab is an academic RAG observatory built on React, Three.js/React Three Fiber, Express, tRPC, and TypeScript. The interface opens directly into a full-viewport vector field: sources, pipeline state, query composition, evidence, and answer inspection appear as lightweight floating instrument controls rather than a conventional dashboard grid.

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

The server performs real format detection, extraction, deterministic chunking, and source metadata capture. It uses the managed `GEMINI_API_KEY` project secret for document/query embeddings and the managed `OPENROUTER_API_KEY` project secret for grounded generation, with Gemini generation retained only as a compatibility fallback if OpenRouter is unavailable. The default OpenRouter generation model is `qwen/qwen-2.5-72b-instruct`. Returned vectors stay in the session workspace, a deterministic PCA-style 3D projection is computed for visualization, query results use cosine similarity over the original vectors, and the actual top-k evidence is sent to the configured generation model. End users do not paste a key into the interface; the client never receives raw embeddings or provider secrets. The embedding credential was live-tested successfully with `gemini-embedding-001` (3072 dimensions), and the OpenRouter model was tested on grounded evidence.

If a document is extracted before a key is available, the source register exposes an explicit re-index action. Provider errors are surfaced as actionable status messages without echoing provider response bodies.

## Supported formats in this build

TXT, Markdown, CSV, JSON, HTML, XML, common source/config files, PDF text layers, DOCX raw text, and XLS/XLSX sheets. Scanned-PDF OCR, PPTX, claim-level citation verification, and alternative retrieval experiments are not claimed yet. Unsupported or empty files remain visible as errors instead of being treated as successful ingestion.

## Session and privacy behavior

The current workspace is keyed by a browser session identifier and stored in server memory. It is intentionally not durable yet; a server restart clears documents, chunks, vectors, and query history. The Gemini and OpenRouter credentials are stored as managed server secrets and are never sent from the browser, shown in the UI, stored in browser storage, placed in URLs, logged, or exported. The current public workspace procedures are suitable for a single-user capstone preview, not a multi-tenant deployment; authentication and server-enforced workspace ownership remain hardening work.

## Project files

- `client/src/pages/Home.tsx` — laboratory shell and interactions.
- `client/src/components/scene/EmbeddingUniverse.tsx` — actual chunk-point visualization and query marker.
- `server/rag/service.ts` — extraction, chunking, Gemini boundaries, PCA projection, retrieval, generation, re-indexing, and deletion.
- `server/routers.ts` — typed RAG procedures.
- `plan.md` — architecture and design decisions.
- `TODO.md` — outcome-based delivery requirements.

Do not put provider keys in `.env`, source control, or exported reports unless you explicitly intend them to be server-managed deployment secrets. The browser configuration endpoint exposes only named public runtime values.
