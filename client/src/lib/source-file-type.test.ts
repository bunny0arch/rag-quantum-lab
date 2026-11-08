import { describe, expect, it } from "vitest";
import { resolveSourceFileType } from "./source-file-type";

describe("source file type labels", () => {
  it.each([
    ["notes.md", "text/markdown", "text", "Text file"],
    ["report.pdf", "application/pdf", "pdf", "PDF document"],
    [
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "presentation",
      "Presentation",
    ],
    [
      "table.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "spreadsheet",
      "Spreadsheet",
    ],
    ["scan.png", "image/png", "image", "Image"],
    ["photo.jpeg", "image/jpeg", "image", "Image"],
  ])("classifies %s", (name, mimeType, kind, label) => {
    const result = resolveSourceFileType(name, mimeType);
    expect(result.kind).toBe(kind);
    expect(result.label).toBe(label);
    expect(result.Icon).toBeTruthy();
  });
});
