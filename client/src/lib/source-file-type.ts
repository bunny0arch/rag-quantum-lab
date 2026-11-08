import {
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react";

export type SourceFileKind =
  | "image"
  | "pdf"
  | "presentation"
  | "spreadsheet"
  | "document"
  | "code"
  | "text"
  | "other";

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "svg",
]);
const codeExtensions = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "go",
  "rs",
  "css",
  "scss",
  "sql",
  "sh",
  "bash",
  "c",
  "h",
  "cpp",
  "hpp",
  "rb",
  "php",
  "swift",
  "kt",
  "dart",
  "vue",
  "svelte",
  "graphql",
  "proto",
  "diff",
  "patch",
  "ps1",
  "bat",
  "toml",
  "ini",
  "cfg",
  "conf",
  "properties",
  "dockerfile",
  "makefile",
]);
const textExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
  "xml",
  "yml",
  "yaml",
  "env",
  "log",
  "rst",
  "tex",
]);

export function resolveSourceFileType(fileName: string, mimeType = "") {
  const extension = fileName.toLowerCase().split(".").pop() || "";
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/") || imageExtensions.has(extension))
    return {
      kind: "image" as const,
      label: "Image",
      shortLabel: extension.toUpperCase() || "IMG",
      Icon: FileImage,
    };
  if (extension === "pdf" || mime === "application/pdf")
    return {
      kind: "pdf" as const,
      label: "PDF document",
      shortLabel: "PDF",
      Icon: FileText,
    };
  if (
    ["ppt", "pptx", "odp"].includes(extension) ||
    mime.includes("presentation")
  )
    return {
      kind: "presentation" as const,
      label: "Presentation",
      shortLabel: extension.toUpperCase() || "SLIDES",
      Icon: Presentation,
    };
  if (
    ["xls", "xlsx", "ods", "csv"].includes(extension) ||
    mime.includes("spreadsheet") ||
    mime === "text/csv"
  )
    return {
      kind: "spreadsheet" as const,
      label: "Spreadsheet",
      shortLabel: extension.toUpperCase() || "SHEET",
      Icon: FileSpreadsheet,
    };
  if (
    ["doc", "docx", "odt", "rtf", "epub"].includes(extension) ||
    mime.includes("wordprocessing") ||
    mime === "application/rtf"
  )
    return {
      kind: "document" as const,
      label: "Document",
      shortLabel: extension.toUpperCase() || "DOC",
      Icon: FileText,
    };
  if (codeExtensions.has(extension))
    return {
      kind: "code" as const,
      label: "Code or configuration",
      shortLabel: extension.toUpperCase(),
      Icon: FileCode2,
    };
  if (textExtensions.has(extension) || mime.startsWith("text/"))
    return {
      kind: "text" as const,
      label: "Text file",
      shortLabel: extension.toUpperCase() || "TXT",
      Icon: FileText,
    };
  return {
    kind: "other" as const,
    label: "File",
    shortLabel: extension.toUpperCase() || "FILE",
    Icon: File,
  };
}
