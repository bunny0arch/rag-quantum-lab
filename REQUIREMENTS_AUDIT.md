# RAG Quantum Lab — Requirements Audit

Audit date: 2026-10-25. This review covers `/home/ubuntu/upload/pasted_content.txt`, `/home/ubuntu/upload/pasted_content_2.txt`, and the final source at commit `e118c11`.

## Status summary

| Area | Status | Evidence / limitation |
|---|---|---|
| Full-viewport spatial instrument | **MET** | `Home.tsx` and `index.css` provide the edge-to-edge vector environment, floating source/query/pipeline/evidence controls, responsive breakpoints, and reduced-motion treatment. |
| Fixed infinite background field | **MET** | `EmbeddingUniverse.tsx` attaches the wave shader to the active camera, uses a large frustum-safe plane, renders it behind the scene, and keeps it independent of orbit rotation. The grid is enlarged to 64 units and the orbit distance is bounded so zoom-out cannot make the map disappear. |
| Visibility / contrast | **MET** | Scene grid, point markers, query marker, retrieval lines, ambient field, metadata, separators, and core text were raised in contrast. Points use bright basic materials rather than low-light-dependent standard materials. |
| Real ingestion pipeline | **MET for implemented formats** | Validation, format detection, extraction, normalization, metadata, deterministic chunking, embedding, indexing, PCA-style projection, retrieval, grounded generation, citations, timings, deletion, and explicit error states are implemented in `server/rag/service.ts`. |
| Scanned PDF OCR | **MISSING** | PDFs use `pdf-parse` text-layer extraction only. Scanned/image-only pages are not OCRed. |
| PPT/PPTX ingestion | **MISSING** | PPTX is explicitly unsupported in the current build. |
| Deterministic chunking | **MET** | Configurable bounded character chunk size and overlap; stable chunk IDs, source offsets, and chunk inspection are present. |
| Real embeddings and retrieval | **MET** | Gemini embeddings are requested server-side, vectors remain separate from projected coordinates, cosine similarity ranks original vectors, model/dimension mismatches are rejected. No reranker or hybrid retrieval is claimed. |
| Grounded generation and citations | **PARTIAL** | Retrieved passages and metadata are supplied to Gemini and source-linked citations are returned. Claim-level citation verification and independent citation correctness scoring are not implemented. |
| 3D interaction | **MET** | Orbit, pan, zoom, reset, fit-to-view, hover, click selection, retrieval highlighting, query highlighting, legends, source/chunk inspection, and a non-3D evidence/chunk alternative are present. |
| Large-index performance | **PARTIAL** | DPR is capped and visibility/reduced-motion safeguards exist, but points are still individual meshes with no clustering, instancing, or large-index subset strategy. |
| WebGL fallback | **MET** | A clear fallback tells the user to use the evidence table when WebGL is unavailable. |
| Event-driven visual states | **PARTIAL** | Ingestion returns structured backend stage events and the UI replays only confirmed events after the mutation returns; query visuals reflect pending/result state. There is no streamed intermediate event channel. |
| SSE/WebSockets | **MISSING** | No SSE endpoint, `EventSource`, WebSocket server, or socket client exists. |
| Upload/query visual sequence | **PARTIAL** | The causal trace, token/vector language, pending states, and retrieval connectors are tied to confirmed operations and real results, but query embedding/retrieval is not streamed live from the provider. |
| Keyboard/accessibility/reduced motion | **PARTIAL** | Query submission, focus-visible styles, labels, reduced-motion behavior, coarse-pointer handling, and evidence-table alternative exist. The canvas itself is not a keyboard-semantic point list; the evidence/chunk UI is the accessible inspection alternative. |
| Exports and deletion | **MET** | Copy actions, TXT export, selectable-text PDF export, and document/chunk/query cleanup are implemented. |
| Evaluation experiments | **MISSING** | There is no reproducible experiment runner, recall/precision dataset, answer-quality benchmark, or ablation result persistence yet. |
| Credential handling | **MET** | The supplied Gemini credential is stored as the managed server-side `GEMINI_API_KEY` secret and is not entered in the browser, placed in source, or returned in exports. |
| Persistence and ownership | **PARTIAL** | The deployed preview uses a process-memory, session-scoped workspace map. Restart loss and lack of authenticated RAG workspace ownership are disclosed; durable RAG tables and per-user authorization are not yet implemented. |
| Error handling | **MET** | Invalid/empty/unsupported/duplicate/oversized files, provider errors, model/quota/network errors, incompatible dimensions, missing index, export errors, and WebGL unavailability have explicit paths. |
| Vercel deployment | **MET for serving** | GitHub repository `bunny0arch/rag-quantum-lab` is linked to Vercel. Production alias serves the client with HTTP 200, `/api/health` returns `{"status":"ok"}`, `/api/trpc/rag.snapshot` returns a valid snapshot, and `/manus-routes.json` returns the declared route set. |

## Honest conclusion

The project is a functional academic capstone RAG laboratory and not a decorative chatbot. The real extraction, embedding, indexing, retrieval, grounding, citation attachment, visualization, export, deletion, managed-key, and deployment paths are working for the implemented scope. The remaining specification gaps are scanned-PDF OCR, PPTX parsing, streamed SSE/WebSocket progress, large-index rendering strategy, claim-level citation verification, reproducible evaluation experiments, and durable authenticated multi-user persistence. These are intentionally disclosed rather than represented as complete.
