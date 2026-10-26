# RAG Quantum Lab — Delivery TODO

## Full-viewport spatial instrument
- [x] Open directly into the working RAG environment with a dark, cinematic scientific visual system; no hero section, marketing homepage, filler onboarding, fake statistics, fake terminal logs, or generic AI SaaS gradients.
- [x] Make the 3D vector space span the viewport edge to edge behind the interface, without a bordered canvas, boxed visualization, dashboard card, or isolated scene section.
- [x] Use floating, frameless source controls and a compact floating drag-and-drop zone integrated into the environment; allow the source control to collapse after upload while preserving file status.
- [x] Use a floating query composer anchored near the bottom with keyboard submission, clear focus states, and an obvious submit action.
- [x] Add a calm custom WebGL wave shader behind the vector field, with reduced-motion behavior and pointer-reactive flow.
- [x] Use metallic instrument-style buttons with hover lift, pressed states, highlight bloom, and subtle whole-interface mouse parallax.
- [x] Keep controls spatially anchored and lightweight, use progressive disclosure, preserve the central environment, and reveal evidence/answer contextually after a query rather than permanently occupying a large opaque panel.
- [x] Provide accessible labels, keyboard navigation, sufficient contrast, responsive collapse for smaller screens, reduced-motion behavior, and a non-3D way to inspect chunks and retrieval results.
- [x] Add a true streamed SSE event channel for intermediate extraction, chunking, embedding, and indexing progress; completed mutation events remain available as the authoritative operation history.

## Real document ingestion and indexing
- [x] Support drag-and-drop, file selection, and multiple files with explicit file validation, format detection, extraction, normalization, metadata extraction, deterministic configurable chunking, embedding generation, index insertion, and readiness states.
- [x] Extract actual content for supported text-based formats and report unsupported, empty, corrupt, oversized, duplicate, OCR, and parser-failure states explicitly instead of pretending they were understood.
- [x] Preserve actual source filename, location metadata, stable chunk IDs, chunk length, and chunk text; allow inspection of extracted content and actual chunk boundaries.
- [x] Use the configured compatible embedding model for document chunks and queries; show model identity and vector dimension where available; never fabricate vectors or compare incompatible embedding spaces.
- [x] Provide re-indexing for chunks extracted before the user configured a Gemini key, without requiring re-upload.

## Functional 3D embedding universe
- [x] Map each displayed point to an actual indexed chunk while storing the actual high-dimensional embedding separately from documented PCA-style visualization coordinates.
- [x] Support orbit, pan, zoom, reset, fit-to-view, hover inspection, point selection, retrieval highlighting, legends, query highlighting, source/chunk inspection, and a non-3D alternative.
- [x] Project vectors with a documented PCA-style method and make clear that projected coordinates are not the original embedding dimensions; do not use projected positions for retrieval ranking.
- [x] Drive visual events from actual backend state and avoid fake progress, fake tokens, fabricated scores, fabricated citations, or arbitrary query placement; processing uses indeterminate state where exact progress is unavailable.
- [x] Use a restrained atmospheric field and pointer parallax; pause or simplify nonessential motion for reduced-motion preferences and coarse pointers.
- [ ] Add clustering or a disclosed visual subset for very large indexes beyond the current sensible point limit.

## Query, retrieval, grounding, and citations
- [x] Allow natural-language questions, keyboard submission, processing status, query history, previous-result inspection, and reruns after retrieval settings change.
- [x] Embed the query through the configured provider, search actual indexed embeddings using cosine similarity, return real ranks/scores/source metadata, and show empty or insufficient-evidence retrieval honestly.
- [x] Assemble the actual retrieved passages and source metadata into the generation request; generate a grounded answer that can acknowledge insufficient evidence.
- [x] Link citations to actual source chunks and distinguish retrieved passages, attached citations, and independently verified citation accuracy in the UI/documentation.
- [ ] Add cancellation for abandoned provider requests and claim-level citation verification rather than source-linked citation attachment only.

## Exports and evaluation
- [x] Provide functional copy actions for answers, selected chunks, and question-answer records with visible failure handling.
- [x] Export TXT and a readable selectable-text PDF containing question, answer, citations, evidence, timestamps, and model/retrieval metadata without credentials.
- [x] Report actual chunk counts, embedding/indexing/query/retrieval/generation/total timings, retrieved IDs and scores, errors, and limitations; never fabricate benchmark values.
- [ ] Add reproducible experiment controls for chunk size, overlap, top-k, and alternative retrieval methods only where implemented; the current build exposes chunking/top-k configuration but not a full experiment runner.

## Security, data management, and resilience
- [x] Use the supplied Gemini credential as the managed `GEMINI_API_KEY` server secret for all RAG operations; never expose it in the interface, source control, client bundles, URLs, logs, or exports; explain provider data flow and persistence behavior.
- [x] Provide document removal controls that remove associated chunks, vectors, and workspace references.
- [x] Handle invalid credentials, unavailable models, quota/rate limits, network interruptions, generation failures, export failures, WebGL unavailability, and empty/oversized/corrupt/duplicate files with concise actionable explanations.
- [ ] Add authenticated server-enforced workspace ownership and durable database-backed document/index storage; the current capstone preview is session-scoped in-memory.

## Verification and delivery
- [x] Run TypeScript diagnostics, relevant tests, backend execution checks, production build verification, desktop/mobile visual inspection, WebGL fallback inspection, and a live Gemini integration check.
- [x] Test extraction-only behavior, empty and unsupported files, duplicate protection, deletion, incompatible model/dimension guards, valid embedding/indexing, actual cosine retrieval, grounded generation, timing capture, and export code paths.
- [x] Document what is implemented, built, functionally tested, end-to-end tested, deployed, and incomplete; include supported formats, environment variables, actual live-tested models, projection method, score calculation, persistence behavior, and run instructions.
