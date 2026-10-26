# RAG Quantum Lab — Requirements Audit

Audit date: 2026-10-26. Scope: `/home/ubuntu/upload/pasted_content.txt`, `/home/ubuntu/upload/pasted_content_2.txt`, and deployed GitHub/Vercel revision `2da1ad2`.

## Verdict

The deployment is a functional RAG laboratory, but **the pasted specifications are not 100% fully met**. The core upload → extraction → chunking → embedding → indexing → query embedding → high-dimensional retrieval → grounded generation → citation/export path is working and was tested in production. Several explicitly required capabilities remain partial or missing and are listed below rather than being represented as complete.

## Requirement status

| Area | Status | Evidence / limitation |
|---|---|---|
| Full-viewport spatial instrument | MET | Edge-to-edge vector environment, floating source/query/pipeline/evidence controls, responsive layout, reduced-motion handling. |
| Fixed infinite background field | MET | Camera-attached shader field remains stable during orbit; grid, framing, contrast, and zoom bounds were corrected. |
| Visual direction | MET | Graphite/near-black scientific instrument aesthetic with restrained chrome, warm typography, selective amber retrieval highlights, no marketing hero or generic purple-blue SaaS treatment. |
| Real ingestion pipeline | MET for implemented formats | Validation, format detection, extraction, normalization, metadata, deterministic chunking, embeddings, indexing, PCA-style projection, retrieval, grounded generation, citations, timings, deletion, and explicit errors are implemented. |
| Scanned-PDF OCR | MISSING | PDF support is text-layer extraction only; image-only/scanned pages are not OCRed. |
| PPT/PPTX ingestion | MISSING | PPTX is not supported in the current build. |
| Deterministic chunking | MET | Configurable bounded size/overlap, stable chunk IDs, offsets, and chunk inspection. |
| Real embeddings and retrieval | MET | Gemini `gemini-embedding-001` embeddings are generated server-side; the deployed smoke test returned 3072 dimensions and cosine retrieval score `0.7502`; projected coordinates are not used for ranking. |
| OpenRouter grounded generation | MET | `OPENROUTER_API_KEY` is stored as a sensitive Vercel secret; default model is `qwen/qwen-2.5-72b-instruct`; production smoke query returned the correct answer with a source citation. |
| Grounding and citation verification | PARTIAL | Evidence is passed to generation and citations link to actual chunks; independent claim-level citation verification/scoring is not implemented. |
| 3D interaction | MET | Orbit, pan, zoom, reset, fit-to-view, hover, selection, source/chunk inspection, query highlighting, retrieval highlighting, legends, and a non-3D evidence alternative. |
| Large-index performance | PARTIAL | Pixel-ratio/reduced-motion/visibility safeguards exist, but there is no clustering, instancing, or disclosed large-index subset strategy. |
| Event-driven visual states | MET for implemented event path | Backend publishes structured pipeline progress; `/api/rag/progress` provides SSE; the client consumes live progress and completed mutations remain authoritative. Query provider internals are not streamed token-by-token. |
| Upload/query visual sequence | PARTIAL | Upload and indexing stages stream real events; query pending/result state and real retrieval connectors are shown, but provider-level query embedding/retrieval/generation sub-events are not streamed individually. |
| Keyboard/accessibility/reduced motion | PARTIAL | Keyboard query submission, focus states, labels, reduced-motion behavior, coarse-pointer safeguards, and evidence-table alternative exist; the WebGL point cloud itself is not a keyboard-semantic list. |
| Exports and deletion | MET | Copy, TXT, selectable-text PDF, and document/chunk/query cleanup are implemented. |
| Evaluation experiments | MISSING | No reproducible experiment runner, recall/precision dataset, answer-quality benchmark, or ablation-result persistence. |
| Credential handling | MET | Gemini embeddings and OpenRouter generation credentials are managed server secrets; no browser key input remains, and secrets are not placed in source, URLs, logs, or exports. |
| Persistence and ownership | PARTIAL | Workspace data remains process-memory/session-scoped; restart loss and lack of authenticated workspace ownership are disclosed. |
| Error handling | MET | Invalid/empty/unsupported/duplicate/oversized files, provider/model/quota/network errors, dimension mismatches, missing index, export failures, and WebGL fallback have explicit paths. |
| Vercel/GitHub delivery | MET | GitHub `bunny0arch/rag-quantum-lab`, commit `2da1ad2`, Vercel production deployment READY; root and `/api/health` return HTTP 200; production OpenRouter RAG smoke test passed. |

## Production smoke test

A throwaway production workspace was ingested and queried after deployment. The query “What does the observatory use for shielding?” returned: **“The observatory uses tungsten shielding [11a2wTlM0d-c001].”** Retrieval returned rank 1 with cosine score `0.7502449971071169`; query embedding took 228 ms, generation took 2457 ms, and total time was 2685 ms.

## Remaining work required for a 100% claim

Implement scanned-PDF OCR, PPTX parsing, large-index rendering strategy, claim-level citation verification, reproducible evaluation experiments, durable authenticated multi-user persistence, and finer-grained streamed query-stage events. These are the reasons the overall specification cannot honestly be marked fully met today.
