import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexExtractedChunks, ingestFiles, queryWorkspace, removeDocument, snapshotWorkspace, subscribeToProgress } from "./service";

const encoded = (content: string) => ({
  name: "capstone-notes.md",
  mimeType: "text/markdown",
  size: Buffer.byteLength(content),
  contentBase64: Buffer.from(content).toString("base64"),
});

async function withGeminiMock<T>(run: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes(":generateContent")) {
      const body = JSON.parse(String(init?.body || "{}")) as { contents?: Array<{ parts?: Array<{ inlineData?: { mimeType?: string } }> }> };
      expect(body.contents?.[0]?.parts?.[1]?.inlineData?.mimeType).toBe("image/png");
      return Response.json({ candidates: [{ content: { parts: [{ text: "Visible label: entangled photons. The diagram shows two linked detectors." }] } }] });
    }
    if (url.includes(":batchEmbedContents")) {
      const body = JSON.parse(String(init?.body || "{}")) as { requests?: unknown[] };
      return Response.json({ embeddings: (body.requests || []).map(() => ({ values: [0.25, 0.5, 0.75] })) });
    }
    return new Response("Unexpected provider endpoint", { status: 500 });
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
}

describe("session RAG service", () => {
  it("extracts and chunks a real text document without claiming it is indexed", async () => {
    const workspaceId = "service-test-extraction";
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [encoded("# RAG\nRetrieval brings evidence into generation.")] });
    expect(result.snapshot.documents[0]?.status).toBe("extracted");
    expect(result.snapshot.index.status).toBe("extracted");
    expect(result.snapshot.chunks[0]?.text).toContain("Retrieval brings evidence");
    expect(result.snapshot.points).toHaveLength(0);
  });

  it("embeds every extracted chunk and marks the source indexed after a successful upload", async () => withGeminiMock(async () => {
    const content = Array.from({ length: 20 }, (_, index) => `Quantum section ${index} describes retrieval, evidence, and measurement.`).join("\n");
    const result = await ingestFiles({ workspaceId: "service-test-vector-upload", files: [encoded(content)], chunkSize: 160, overlap: 0 });
    const document = result.snapshot.documents[0]!;
    expect(document.status).toBe("ready");
    expect(document.indexedChunkCount).toBe(document.chunkCount);
    expect(document.chunkCount).toBeGreaterThan(1);
    expect(result.snapshot.index.status).toBe("ready");
    expect(result.snapshot.points).toHaveLength(document.chunkCount);
    expect(result.snapshot.chunks.every(chunk => chunk.embeddingDimension === 3)).toBe(true);
  }));

  it("re-indexes browser-supplied extracted chunks on a cold instance", async () => withGeminiMock(async () => {
    const extracted = await ingestFiles({ workspaceId: "service-test-reindex-source", apiKey: null, files: [encoded("A coherent source for deterministic re-indexing.")] });
    const result = await indexExtractedChunks({ workspaceId: "service-test-reindex-instance", fallbackChunks: extracted.snapshot.chunks, fallbackDocuments: extracted.snapshot.documents });
    expect(result.snapshot.documents[0]?.status).toBe("ready");
    expect(result.snapshot.documents[0]?.indexedChunkCount).toBe(1);
    expect(result.snapshot.index.status).toBe("ready");
    expect(result.snapshot.points).toHaveLength(1);
  }));

  it("extracts image text and visual description, then chunks and embeds it", async () => withGeminiMock(async () => {
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(96, 48);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.fillText("Photon map", 8, 24);
    const bytes = canvas.toBuffer("image/png");
    const result = await ingestFiles({
      workspaceId: "service-test-image-upload",
      files: [{ name: "photon-map.png", mimeType: "image/png", size: bytes.length, contentBase64: bytes.toString("base64") }],
    });
    expect(result.snapshot.documents[0]?.status).toBe("ready");
    expect(result.snapshot.chunks[0]?.location).toContain("image OCR");
    expect(result.snapshot.chunks[0]?.text).toContain("entangled photons");
    expect(result.snapshot.points).toHaveLength(1);
  }));

  it("returns a visible document error when a file cannot be extracted", async () => {
    const invalid = { name: "broken.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 4, contentBase64: Buffer.from("nope").toString("base64") };
    const result = await ingestFiles({ workspaceId: "service-test-parser-failure", apiKey: null, files: [invalid] });
    expect(result.snapshot.documents[0]?.status).toBe("error");
    expect(result.snapshot.documents[0]?.error).toBeTruthy();
    expect(result.snapshot.documents[0]?.chunkCount).toBe(0);
    expect(result.snapshot.chunks).toHaveLength(0);
  });

  it("keeps chunks and reports the missing provider when vector indexing is attempted without a key", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const extracted = await ingestFiles({ workspaceId: "service-test-index-no-key-source", apiKey: null, files: [encoded("Chunk text remains available for a later retry.")] });
      const result = await indexExtractedChunks({ workspaceId: "service-test-index-no-key-instance", fallbackChunks: extracted.snapshot.chunks, fallbackDocuments: extracted.snapshot.documents });
      expect(result.snapshot.documents[0]?.status).toBe("extracted");
      expect(result.snapshot.documents[0]?.error).toContain("GEMINI_API_KEY");
      expect(result.snapshot.chunks).toHaveLength(1);
      expect(result.snapshot.index.status).toBe("extracted");
      expect(result.events.some(item => item.stage === "error")).toBe(true);
    } finally {
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("accepts unknown extensions when their payload is valid readable text", async () => {
    const workspaceId = "service-test-unsupported";
    const file = { name: "archive.bin", mimeType: "application/octet-stream", size: 3, contentBase64: Buffer.from("raw").toString("base64") };
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [file] });
    expect(result.snapshot.documents[0]?.status).toBe("extracted");
    expect(result.snapshot.chunks[0]?.text).toBe("raw");
  });

  it("extracts real text, CSV, JSON, HTML, PDF, DOCX, and XLSX sample files", async () => {
    const formats = [
      ["txt", "text/plain", "Quantum sample dossier"],
      ["csv", "text/csv", "Retrieval"],
      ["json", "application/json", "vector index"],
      ["html", "text/html", "Decoherence"],
      ["pdf", "application/pdf", "Born rule"],
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Quantum tunneling"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "superposition"],
      ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Quantum slide sample"],
      ["rtf", "application/rtf", "Measurements"],
    ] as const;
    const files = formats.map(([extension, mimeType]) => {
      const bytes = readFileSync(new URL(`./fixtures/quantum-sample.${extension}`, import.meta.url));
      return { name: `quantum-sample.${extension}`, mimeType, size: bytes.length, contentBase64: bytes.toString("base64") };
    });
    const result = await ingestFiles({ workspaceId: "service-test-multi-format", apiKey: null, files });
    expect(result.snapshot.documents).toHaveLength(formats.length);
    expect(result.snapshot.documents.every(document => document.status === "extracted")).toBe(true);
    const pdfRuntime = globalThis as typeof globalThis & { DOMMatrix?: unknown; ImageData?: unknown; Path2D?: unknown };
    expect(typeof pdfRuntime.DOMMatrix).toBe("function");
    expect(typeof pdfRuntime.ImageData).toBe("function");
    expect(typeof pdfRuntime.Path2D).toBe("function");
    for (const [extension, , expectedText] of formats) {
      const chunk = result.snapshot.chunks.find(item => item.sourceName === `quantum-sample.${extension}`);
      expect(chunk?.text.toLowerCase()).toContain(expectedText.toLowerCase());
      if (extension === "html") expect(chunk?.text).not.toContain("<html");
    }
  });

  it("answers from existing chunks without depending on embedding or generation providers", async () => {
    const uploadWorkspaceId = "service-test-local-query-upload";
    const queryWorkspaceId = "service-test-local-query-instance";
    const geminiKey = process.env.GEMINI_API_KEY;
    const routerKey = process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const uploaded = await ingestFiles({ workspaceId: uploadWorkspaceId, apiKey: null, files: [encoded("Quantum retrieval uses chunk vectors. Vector indexing supports evidence lookup.")] });
      const point = { chunkId: uploaded.snapshot.chunks[0]!.id, documentId: uploaded.snapshot.chunks[0]!.documentId, sourceName: "capstone-notes.md", location: "test", excerpt: "Quantum retrieval uses chunk vectors", x: 0.2, y: -0.1, z: 0.3 };
      const result = await queryWorkspace({ workspaceId: queryWorkspaceId, question: "How does vector indexing support retrieval?", topK: 3, fallbackChunks: uploaded.snapshot.chunks, fallbackDocuments: uploaded.snapshot.documents, fallbackPoints: [point] });
      expect(result.query.answer).toContain("source excerpts, not a generated answer");
      expect(result.query.results[0]?.text).toContain("Vector indexing");
      expect(result.query.results[0]?.metric).toBe("keyword_overlap");
      expect(result.query.citations.length).toBeGreaterThan(0);
      expect(result.query.queryProjection).toEqual([0.2, -0.1, 0.3]);
      expect(result.snapshot.documents[0]?.name).toBe("capstone-notes.md");
      expect(result.snapshot.points).toEqual([point]);
    } finally {
      if (geminiKey !== undefined) process.env.GEMINI_API_KEY = geminiKey;
      else delete process.env.GEMINI_API_KEY;
      if (routerKey !== undefined) process.env.OPENROUTER_API_KEY = routerKey;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("refuses to generate when no indexed evidence is relevant to the question", async () => {
    const workspaceId = "service-test-irrelevant-query";
    const geminiKey = process.env.GEMINI_API_KEY;
    const routerKey = process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const uploaded = await ingestFiles({ workspaceId: `${workspaceId}-upload`, apiKey: null, files: [encoded("Quantum retrieval uses chunk vectors and evidence lookup.")] });
      const point = { chunkId: uploaded.snapshot.chunks[0]!.id, documentId: uploaded.snapshot.chunks[0]!.documentId, sourceName: "capstone-notes.md", location: "test", excerpt: "Quantum retrieval uses chunk vectors", x: 0.2, y: -0.1, z: 0.3 };
      const result = await queryWorkspace({ workspaceId, question: "What is the capital of France?", topK: 3, fallbackChunks: uploaded.snapshot.chunks, fallbackDocuments: uploaded.snapshot.documents, fallbackPoints: [point] });
      expect(result.query.status).toBe("insufficient");
      expect(result.query.answer).toContain("insufficient");
      expect(result.query.results).toHaveLength(0);
      expect(result.query.citations).toHaveLength(0);
    } finally {
      if (geminiKey !== undefined) process.env.GEMINI_API_KEY = geminiKey;
      else delete process.env.GEMINI_API_KEY;
      if (routerKey !== undefined) process.env.OPENROUTER_API_KEY = routerKey;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("does not duplicate the same filename and byte size in a session", async () => {
    const workspaceId = "service-test-duplicate";
    const file = encoded("same source");
    await ingestFiles({ workspaceId, apiKey: null, files: [file] });
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [file] });
    expect(result.snapshot.documents).toHaveLength(2);
    expect(result.snapshot.documents[0]?.status).toBe("error");
    expect(result.snapshot.chunks).toHaveLength(1);
  });

  it("removes a document and its associated chunks", async () => {
    const workspaceId = "service-test-delete";
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [encoded("to be removed")] });
    const documentId = result.snapshot.documents[0]!.id;
    const after = removeDocument(workspaceId, documentId);
    expect(after.documents).toHaveLength(0);
    expect(after.chunks).toHaveLength(0);
    expect((await snapshotWorkspace(workspaceId)).chunks).toHaveLength(0);
  });

  it("publishes live extraction and chunk progress with a stable operation id", async () => {
    const workspaceId = "service-test-progress";
    const events: Array<{ operationId: string; stage: string; message: string }> = [];
    const unsubscribe = subscribeToProgress(workspaceId, event => events.push(event));
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [encoded("streamed extraction content")] });
    unsubscribe();
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.map(event => event.stage)).toEqual(expect.arrayContaining(["extracting", "chunking", "ready"]));
    expect(new Set(events.map(event => event.operationId))).toEqual(new Set([result.operationId]));
    expect(events.some(event => event.message.includes("Extracted"))).toBe(true);
  });
});
