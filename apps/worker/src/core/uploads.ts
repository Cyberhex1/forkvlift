/**
 * Task 1.5: uploads to R2.
 *
 * 1. POST /api/uploads reserves a key (kind, type, size) for 15 minutes.
 * 2. PUT  /api/uploads/:key streams the bytes to R2. Only the user who reserved
 *    the key can upload, the type must match, and images are checked by their
 *    magic bytes so nothing executable (HTML, SVG) ever lands as "an image".
 * 3. GET  /api/media/:key serves it, resized on the fly when the IMAGES binding
 *    (Cloudflare Images) is configured.
 */
import { HttpError, notFound } from "./errors";
import { randomToken } from "./ids";

export type UploadKind = "thumbnail" | "media" | "avatar" | "resource";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const RULES: Record<UploadKind, { types: string[]; maxBytes: number }> = {
  thumbnail: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  avatar: { types: IMAGE_TYPES, maxBytes: 2 * 1024 * 1024 },
  media: { types: [...IMAGE_TYPES, "video/mp4", "video/webm"], maxBytes: 25 * 1024 * 1024 },
  resource: { types: ["application/zip", "text/markdown", "text/plain"], maxBytes: 10 * 1024 * 1024 },
};
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "application/zip": "zip", "text/markdown": "md", "text/plain": "txt",
};
const RESERVATION_TTL = 15 * 60;

interface Reservation {
  userId: string;
  kind: UploadKind;
  contentType: string;
  size: number;
}

/** Keys are flat ("<kind>.<user>.<random>.<ext>") so they fit one URL segment. */
const KEY_RE = /^(thumbnail|media|avatar|resource)\.([a-z0-9_]+)\.([A-Za-z0-9_-]{16,})\.(png|jpg|webp|gif|mp4|webm|zip|md|txt)$/;

export function mediaUrl(key: string): string {
  return `/api/media/${key}`;
}

function bucket(env: Env): R2Bucket {
  if (!env.MEDIA) throw new HttpError("unavailable", "Uploads aren't available right now.");
  return env.MEDIA;
}

export async function reserveUpload(env: Env, userId: string, kind: UploadKind, contentType: string, size: number) {
  const rule = RULES[kind];
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (!rule.types.includes(type)) throw new HttpError("invalid_request", `Can't upload ${type} as a ${kind}. Allowed: ${rule.types.join(", ")}`);
  if (size > rule.maxBytes) throw new HttpError("invalid_request", `Too big: ${kind} uploads are limited to ${Math.round(rule.maxBytes / 1024 / 1024)} MB`);
  bucket(env);
  const key = `${kind}.${userId}.${randomToken(12)}.${EXT[type]}`;
  const reservation: Reservation = { userId, kind, contentType: type, size };
  await env.CACHE.put(`upload:${key}`, JSON.stringify(reservation), { expirationTtl: RESERVATION_TTL });
  return { key, uploadUrl: `/api/uploads/${key}`, expiresAt: new Date(Date.now() + RESERVATION_TTL * 1000).toISOString() };
}

export async function storeUpload(env: Env, userId: string, key: string, request: Request) {
  const reservation = await env.CACHE.get<Reservation>(`upload:${key}`, "json");
  if (!reservation || reservation.userId !== userId) throw new HttpError("forbidden", "Reserve an upload first (it expires after 15 minutes).");
  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== reservation.contentType) throw new HttpError("invalid_request", `Expected Content-Type ${reservation.contentType}`);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) throw new HttpError("invalid_request", "Empty upload");
  if (bytes.byteLength > reservation.size || bytes.byteLength > RULES[reservation.kind].maxBytes) {
    throw new HttpError("invalid_request", "Upload is larger than reserved");
  }
  if (reservation.contentType.startsWith("image/") && sniffImage(bytes) !== reservation.contentType) {
    throw new HttpError("invalid_request", "That file isn't the image type it claims to be.");
  }

  await bucket(env).put(key, bytes, {
    httpMetadata: { contentType: reservation.contentType, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { userId, kind: reservation.kind },
  });
  await env.CACHE.delete(`upload:${key}`);
  return { key, url: mediaUrl(key) };
}

/** Detect PNG/JPEG/GIF/WebP from magic bytes. */
export function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export async function serveMedia(env: Env, key: string, width: number | undefined): Promise<Response> {
  if (!KEY_RE.test(key)) throw notFound("Not found");
  const object = await bucket(env).get(key);
  if (!object) throw notFound("Not found");
  const type = object.httpMetadata?.contentType ?? "application/octet-stream";
  const headers = new Headers({
    "content-type": type,
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    etag: object.httpEtag,
  });
  // Non-image files always download rather than render.
  if (!type.startsWith("image/") && !type.startsWith("video/")) headers.set("content-disposition", `attachment; filename="${key}"`);

  const images = (env as { IMAGES?: ImagesBinding }).IMAGES;
  if (width && images && type.startsWith("image/") && type !== "image/gif") {
    const resized = await images.input(object.body).transform({ width, fit: "scale-down" }).output({ format: "image/webp", quality: 82 });
    headers.set("content-type", "image/webp");
    return new Response(resized.image(), { headers });
  }
  return new Response(object.body, { headers });
}

/** Keys a user may attach to their own project (theirs, uploaded, right kind). */
export async function assertOwnedUploads(env: Env, userId: string, keys: string[], kinds: UploadKind[]): Promise<void> {
  for (const key of keys) {
    const m = KEY_RE.exec(key);
    if (!m || m[2] !== userId || !kinds.includes(m[1] as UploadKind)) throw new HttpError("invalid_request", `Unknown upload "${key}"`);
    const head = await bucket(env).head(key);
    if (!head) throw new HttpError("invalid_request", `Upload "${key}" hasn't finished`);
  }
}

export function mediaKindOf(key: string): "image" | "gif" | "video" {
  if (key.endsWith(".gif")) return "gif";
  if (key.endsWith(".mp4") || key.endsWith(".webm")) return "video";
  return "image";
}