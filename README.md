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

The server performs format detection, extraction, deterministic chunking, source metadata capture, vector embedding, retrieval, and grounded generation. The managed `GEMINI_API_KEY` project secret is used for document/query embeddings and for OCR/visual descriptions of raster images and scanned PDFs; the configured Gemini model is the default generation path, with OpenRouter available for compatible model choices. Returned vectors stay in the session workspace, a deterministic PCA-style 3D projection is computed for visualization, query results use cosine similarity over the original vectors, and the actual top-k evidence is sent to the configured generation model. End users do not paste a key into the interface; the client never receives raw embeddings or provider secrets. Without the embedding key, text documents can still be extracted and chunked, but they remain clearly marked as awaiting vectors until re-indexed.

If a document is extracted before a key is available, the source register exposes an explicit re-index action. Provider errors are surfaced as actionable status messages without echoing provider response bodies.

## Supported formats in this build

TXT, Markdown, CSV, JSON, HTML, SVG, XML, common source/config files, PDF text layers (with Gemini OCR fallback for scanned PDFs), DOCX, XLS/XLSX/ODS, PPTX slide text, RTF, ODT/ODP, EPUB, and raster PNG/JPEG/WebP/GIF/BMP images are supported. Raster images are normalized to PNG and sent to Gemini for visible-text transcription plus a concise visual description before chunking and embedding; this requires the managed `GEMINI_API_KEY`. Unsupported, corrupt, empty, oversized, or unreadable files remain visible with a per-source error rather than appearing successfully indexed. Claim-level citation verification and alternative retrieval experiments are still not claimed.

## Session and privacy behavior

The current workspace is keyed by a browser session identifier and stored in server memory. It is intentionally not durable yet; a server restart clears documents, chunks, vectors, and query history. Text and image/PDF content sent for embeddings or visual extraction is processed through the managed Gemini provider. Gemini and OpenRouter credentials are stored as managed server secrets and are never sent from the browser, shown in the UI, stored in browser storage, placed in URLs, logged, or exported; the UI reports only whether provider credentials are configured. The current public workspace procedures are suitable for a single-user capstone preview, not a multi-tenant deployment; authentication and server-enforced workspace ownership remain hardening work.

## Project files

- `client/src/pages/Home.tsx` — laboratory shell and interactions.
- `client/src/components/scene/EmbeddingUniverse.tsx` — actual chunk-point visualization and query marker.
- `server/rag/service.ts` — extraction, chunking, Gemini boundaries, PCA projection, retrieval, generation, re-indexing, and deletion.
- `server/routers.ts` — typed RAG procedures.
- `plan.md` — architecture and design decisions.
- `TODO.md` — outcome-based delivery requirements.

Do not put provider keys in `.env`, source control, or exported reports unless you explicitly intend them to be server-managed deployment secrets. The browser configuration endpoint exposes only named public runtime values.
