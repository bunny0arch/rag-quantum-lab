import { describe, expect, it } from "vitest";
import { ingestFiles, removeDocument, snapshotWorkspace, subscribeToProgress } from "./service";

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

  it("keeps unsupported files as explicit errors", async () => {
    const workspaceId = "service-test-unsupported";
    const file = { name: "archive.bin", mimeType: "application/octet-stream", size: 3, contentBase64: Buffer.from("raw").toString("base64") };
    const result = await ingestFiles({ workspaceId, apiKey: null, files: [file] });
    expect(result.snapshot.documents[0]?.status).toBe("error");
    expect(result.snapshot.documents[0]?.error).toContain("Unsupported format");
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
