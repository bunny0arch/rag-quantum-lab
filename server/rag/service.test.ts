import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ingestFiles, queryWorkspace, removeDocument, snapshotWorkspace, subscribeToProgress } from "./service";

const encoded = (content: string) => ({
  name: "capstone-notes.md",
  mimeType: "text/markdown",
  size: Buffer.byteLength(content),
  contentBase64: Buffer.from(content).toString("base64"),
});

describe("session RAG service", () => {
  it("extracts and chunks a real text document without claiming it is indexed", async () => {
    const workspaceId = "service-test-extraction";
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [encoded("# RAG\nRetrieval brings evidence into generation.")] });
    expect(result.snapshot.documents[0]?.status).toBe("extracted");
    expect(result.snapshot.index.status).toBe("extracted");
    expect(result.snapshot.chunks[0]?.text).toContain("Retrieval brings evidence");
    expect(result.snapshot.points).toHaveLength(0);
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
      expect(result.snapshot.documents[0]?.name).toBe("capstone-notes.md");
      expect(result.snapshot.points).toEqual([point]);
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
