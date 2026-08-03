// WhatsApp Cloud API's real per-media-kind constraints. Uploading something
// outside these silently "succeeds" (the file lands in storage / even in
// Meta's own upload endpoint) and only fails later — either synchronously
// when sending, or asynchronously via a status webhook — with a raw English
// error disconnected from the moment the agent picked the file. Validating
// against this table at upload time turns that into an immediate, clear
// message instead.
export type MediaKind = "image" | "video" | "audio" | "document";

export const allowedMimesByMediaKind: Record<MediaKind, string[]> = {
  image: ["image/jpeg", "image/png"],
  // Broader than what WhatsApp itself accepts — every video gets
  // transcoded to H.264/AAC mp4 (see video-transcode.ts) regardless of
  // source container/codec, so anything ffmpeg can decode is fine here.
  video: ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska", "video/x-msvideo"],
  audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
export const maxBytesByMediaKind: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

export const mediaKindLabel: Record<MediaKind, string> = {
  image: "una imagen",
  video: "un video",
  audio: "un audio",
  document: "un documento",
};

export const mimeLabel: Record<string, string> = {
  "image/png": "una imagen PNG",
  "image/jpeg": "una imagen JPEG",
  "video/mp4": "un video MP4",
  "video/quicktime": "un video MOV",
  "video/webm": "un video WEBM",
  "video/x-matroska": "un video MKV",
  "video/x-msvideo": "un video AVI",
  "audio/wav": "un audio WAV",
};

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)}MB`;
}

export function mediaKindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export function validateMediaMime(kind: MediaKind, mimeType: string): string | null {
  const allowedMimes = allowedMimesByMediaKind[kind];
  if (allowedMimes && !allowedMimes.includes(mimeType)) {
    const gotLabel = mimeLabel[mimeType] ?? `un archivo "${mimeType || "desconocido"}"`;
    return `Ese archivo es ${gotLabel}, pero esta acción necesita ${mediaKindLabel[kind]}. WhatsApp solo acepta: ${allowedMimes.join(", ")}.`;
  }
  return null;
}

export function validateMediaSize(kind: MediaKind, sizeBytes: number): string | null {
  const maxBytes = maxBytesByMediaKind[kind];
  if (maxBytes && sizeBytes > maxBytes) {
    return `El archivo pesa ${formatMB(sizeBytes)}, pero WhatsApp permite máximo ${formatMB(maxBytes)} para ${mediaKindLabel[kind]}.`;
  }
  return null;
}

/** Returns a user-facing Spanish error, or null if the file is within limits. */
export function validateMediaFile(kind: MediaKind, file: { type: string; size: number }): string | null {
  return validateMediaMime(kind, file.type) ?? validateMediaSize(kind, file.size);
}
