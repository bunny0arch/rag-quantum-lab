# RAG Quantum Lab — Delivery TODO

## Direct-to-workspace scientific interface
- [ ] Open directly into the working RAG environment with a dark, cinematic scientific visual system; no hero section, marketing homepage, filler onboarding, fake statistics, fake terminal logs, or generic AI SaaS gradients.
- [ ] Maintain coordinated left ingestion/source controls, central interactive embedding universe and pipeline state, and right query/retrieval/evidence/answer controls; adapt or collapse panels for smaller screens without losing core functionality.
- [ ] Provide accessible labels, keyboard navigation, sufficient contrast, reduced-motion behavior, and a non-3D way to inspect chunks and retrieval results.

## Real document ingestion and indexing
- [ ] Support drag-and-drop, file selection, and multiple files with explicit file validation, format detection, extraction, normalization, metadata extraction, deterministic configurable chunking, embedding generation, index insertion, and readiness states.
- [ ] Extract actual content for supported text-based formats and report unsupported, empty, corrupt, oversized, duplicate, OCR, and parser-failure states explicitly instead of pretending they were understood.
- [ ] Preserve actual source filename, location metadata, stable chunk IDs, chunk length, and chunk text; allow inspection of extracted content and actual chunk boundaries.
- [ ] Use the configured compatible embedding model for document chunks and queries; show model identity and vector dimension where available; never fabricate vectors or compare incompatible embedding spaces.

## Functional 3D embedding universe
- [ ] Map each displayed point to an actual indexed chunk while storing the actual high-dimensional embedding separately from the documented 3D visualization coordinates.
- [ ] Support orbit, pan, zoom, reset, fit-to-view, hover inspection, point selection, source filtering, legends, query highlighting, retrieval highlighting, and a non-3D alternative.
- [ ] Project vectors with a documented method and make clear that projected coordinates are not the original embedding dimensions; do not use projected positions for retrieval ranking.
- [ ] Drive visual events from actual backend state and avoid fake progress, fake tokens, fabricated scores, fabricated citations, or arbitrary query placement.

## Query, retrieval, grounding, and citations
- [ ] Allow natural-language questions, keyboard submission, clear processing status, cancellation where supported, query history, previous-result inspection, and reruns after retrieval settings change.
- [ ] Embed the query through the configured provider, search actual indexed embeddings using the configured metric, return real ranks/scores/source metadata, and show empty or low-relevance retrieval honestly.
- [ ] Assemble the actual retrieved passages and source metadata into the generation request; generate a grounded answer that can acknowledge insufficient evidence.
- [ ] Link citations to actual source chunks and distinguish retrieved passages, attached citations, and independently verified citation accuracy.

## Exports and evaluation
- [ ] Provide functional copy actions for answer, answer with citations, selected evidence, and useful question-answer records with success/failure feedback.
- [ ] Export TXT and a readable selectable-text PDF containing question, answer, citations, evidence summary, timestamps, and relevant model/retrieval metadata without credentials.
- [ ] Report actual chunk counts, failed chunks, embedding/indexing/query/retrieval/generation/total timings, retrieved IDs and scores, errors, and limitations; never fabricate benchmark values.
- [ ] Support reproducible experiments for chunk size, overlap, top-k, and alternative retrieval methods only where implemented, and label exploratory measurements as exploratory when no validated labels or reference answers exist.

## Security, data management, and resilience
- [ ] Keep user-provided Gemini credentials in session memory where feasible; never expose them in source control, client bundles, URLs, logs, or exports; explain provider data flow and persistence behavior.
- [ ] Provide document removal controls that remove associated chunks, vectors, query state, and workspace references where applicable.
- [ ] Handle invalid credentials, unavailable models, quota/rate limits, network interruptions, generation failures, export failures, WebGL unavailability, browser memory pressure, and cancellation with concise actionable explanations.

## Verification and delivery
- [ ] Run TypeScript diagnostics, relevant tests, actual execution checks, browser/backend error inspection, and production build verification before claiming completion.
- [ ] Test representative supported formats, empty/corrupt/unsupported files, multiple documents, relevant and insufficient-evidence questions, citations, exports, deletion, large point clouds, reduced motion, and WebGL fallback as infrastructure permits.
- [ ] Document what is implemented, built, functionally tested, end-to-end tested, deployed, and incomplete; include supported formats, environment variables, actual models, projection method, score calculation, experiments, performance checks, and run/deploy instructions.
