// Allowed finding-attachment types and helpers. Uploads are limited to DOCX,
// common image formats, and PDF, capped at MAX_ATTACHMENT_BYTES.

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_ATTACHMENT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};

export const ATTACHMENT_ACCEPT = Object.entries(ALLOWED_ATTACHMENT_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(",");

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

/** Validate by MIME type, falling back to extension when the browser omits a type. */
export function isAllowedAttachment(mimeType: string, filename: string): boolean {
  const ext = extensionOf(filename);
  if (mimeType && ALLOWED_ATTACHMENT_TYPES[mimeType]) {
    return ALLOWED_ATTACHMENT_TYPES[mimeType].includes(ext) || ext === "";
  }
  return Object.values(ALLOWED_ATTACHMENT_TYPES).some((exts) => exts.includes(ext));
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip anything unsafe for a Content-Disposition filename. */
export function safeFilename(name: string): string {
  return name.replace(/[^\w.\-() ]/g, "_").slice(0, 200) || "attachment";
}
