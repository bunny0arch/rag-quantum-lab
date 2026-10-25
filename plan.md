# RAG Quantum Lab — Implementation Plan

## Scope and approach

RAG Quantum Lab will remain on the initialized React 19 + Vite + Express + tRPC + Drizzle stack. The working slice establishes the core capstone experience end-to-end without fabricating AI activity: a direct-to-workspace interface, session-scoped document ingestion, deterministic extraction/chunking, Gemini-backed embedding and generation boundaries, retrieval state, evidence inspection, export controls, and an interactive Three.js embedding-space visualization driven by returned chunk data. The primary composition is a full-viewport spatial instrument with lightweight floating controls rather than a dashboard grid.

The product will use a session workspace identifier generated in the browser. Uploaded files stay in the active session path; the managed `GEMINI_API_KEY` is resolved only on the server and never entered or exposed in the browser. The initial server store is an explicit in-memory workspace service so the first slice is usable without inventing a persistence model; the selected database remains available for a later durable document/index migration. The UI will clearly label the current session and any unavailable capability rather than display fake results.

## Architecture

- `client/src/pages/Home.tsx`: working full-viewport laboratory shell with floating source, query, pipeline, evidence, and inspection controls.
- `client/src/components/scene/EmbeddingUniverse.tsx`: lazy-loaded React Three Fiber scene, ambient non-data field, actual chunk points, query marker, orbit controls, reset/fit actions, hover and selection, and restrained pointer parallax.
- `client/src/components/ingestion/`: drop zone, source list, processing timeline, and chunk/source inspection.
- `client/src/components/query/`: query composer and query history.
- `client/src/components/retrieval/`: ranked evidence and score explanations.
- `client/src/components/answer/`: grounded answer, citations, clipboard, TXT and PDF export.
- `client/src/components/settings/`: session-only Gemini key/model configuration.
- `client/src/components/ui/`: existing shadcn primitives plus the adapted navigation pill if it serves a real section-navigation need.
- `client/src/lib/ragTypes.ts`: shared client/server-safe domain types.
- `server/rag/`: format detection, extraction, chunking, embedding, vector search, generation, projection, and workspace orchestration.
- `server/routers.ts`: typed `rag` procedures for ingest, query, workspace state, and deletion.
- `shared/types.ts`: pipeline event and RAG result contracts shared by both sides.
- `public/manus-routes.json`: route manifest for `/` and `/404`.

## Pipeline decisions

1. Extraction is parser-first. The first slice supports text, Markdown, CSV, JSON, HTML, XML, and simple source/config files directly; PDF/DOCX/XLSX/PPTX support will be added through format-specific dependencies only where the parser is reliable.
2. Chunking is deterministic, configurable by size and overlap, and preserves source filename, location, stable chunk ID, and excerpt.
3. Embeddings use the configured Gemini embedding endpoint. If no valid user key is present, extraction/chunking can still be inspected but indexing remains blocked and the UI says why.
4. Retrieval uses cosine similarity over actual returned embeddings, never projected coordinates.
5. Projection uses a deterministic, documented PCA-style power-iteration reduction; the UI labels it as a visualization projection, not original embedding dimensions. Retrieval never uses projected coordinates.
6. Generation receives the actual top-k retrieved passages and source metadata. Citation labels are source-linked but not described as independently verified unless verification is implemented.

## Design direction

Three possible styles (tail probabilities):

- Observational instrument / scientific console — 0.06
- Monochrome editorial archive — 0.07
- Minimal cybernetic cartography — 0.04

Chosen direction: **Observational instrument / scientific console**.

- **Design Movement:** Cinematic scientific instrumentation with an editorial control-room discipline.
- **Core Principles:** data before decoration; warm readable type on graphite; restrained motion tied to pipeline states; spatial depth with precise, thin separators.
- **Color Philosophy:** near-black graphite preserves focus on the evidence; warm white makes dense technical content readable; amber marks retrieval and selection only; muted sage marks readiness without turning the interface into a neon dashboard.
- **Layout Paradigm:** a full-viewport vector field with frameless floating instrument readouts. Source ingestion, query composition, pipeline state, and contextual evidence appear as spatial overlays that preserve the environment instead of boxing it into a card.
- **Signature Elements:** amber retrieval trajectories; a thin vertical pipeline rail; bracketed source IDs and monospaced evidence metadata.
- **Interaction Philosophy:** every action reveals state or provenance; hover inspects, selection anchors, query submission traces a real route through the workspace, and progressive disclosure keeps the field visible.
- **Animation:** short, stateful transitions with controlled inertia and a restrained pointer parallax; no perpetual fake processing; ambient motion pauses or simplifies under reduced motion and on coarse pointers.
- **Typography System:** a clean sans for interface copy paired with a compact mono for IDs, timings, and model metadata; hierarchy stays tight and avoids oversized promotional headings.
- **Brand Essence:** an explorable RAG laboratory for students and evaluators who need to see how evidence becomes an answer — precise, inspectable, alive.
- **Brand Voice:** calm and exact. Example lines: “Awaiting a source.” and “Evidence assembled from 3 indexed chunks.”
- **Wordmark & Logo:** `RQ` as a small orbital mark: two offset brackets around a single amber point, suggesting retrieval around a query.
- **Signature Brand Color:** retrieval amber `#D6A85E`.

## Implementation sequence

1. Establish route manifest, plan, todo, dark design tokens, and the full-viewport floating shell.
2. Add the real server-side RAG contracts and session workspace service.
3. Add ingestion, chunk inspection, settings, and query state.
4. Add the 3D scene and connect actual points/query/retrieval state.
5. Add exports, deletion, evaluation readouts, and error states.
6. Run diagnostics, typecheck, tests, build, start the preview service, inspect the route manifest, and fix confirmed issues.

## Material constraints

Use existing dependencies first. Add only the packages needed for the real product: Three.js/React Three Fiber for the visualization and focused parsers for supported formats. Do not add paid runtime dependencies, fake hosted services, or model calls that bypass the user-provided Gemini credential. Do not expose keys in browser storage, URLs, logs, exports, or the client bundle.

## Known first-slice limitations

- The initial session workspace is in memory and is lost when the server restarts; a database-backed document/index migration remains a later hardening step.
- OCR for scanned PDFs and rich Office parsing will be surfaced as unsupported or pending until a parser is added and tested; the UI will not claim universal file support.
- The provided development credential was live-tested successfully with `gemini-embedding-001` (3072 dimensions) and `gemini-3.5-flash`; other provider models remain user-configurable and may return provider-specific availability errors.
- Citation source-linking is implemented from retrieved chunk metadata; independent claim-level citation verification is not claimed.
