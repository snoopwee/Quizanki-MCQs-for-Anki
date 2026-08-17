// Shrinks card images in the browser before upload. Big Anki media (photos,
// screenshots) re-encoded to WebP at a capped size is typically 60–90% smaller,
// so uploads are faster and Storage holds far less. Only lossy raster inputs
// (PNG/JPEG) are touched; GIF (often animated — flattening would kill it), WebP,
// SVG and already-tiny images pass through untouched. Any failure or a
// no-smaller result falls back to the original file, so this can never make an
// upload worse or break in a canvas-less environment (SSR / tests).

// Cap the long edge well above any card's on-screen size (fullscreen on a 4K
// display is ~2160px tall, and cards render far smaller) so downscaling is never
// visible; images already under this keep their native resolution.
const MAX_EDGE = 2048;
// WebP quality: 0.85 is visually indistinguishable from the source even on sharp
// text / line-art / diagrams, while still shrinking photos dramatically.
const QUALITY = 0.85;
const MIN_BYTES = 30 * 1024; // below this, re-encoding isn't worth the overhead
const COMPRESSIBLE = new Set(["image/png", "image/jpeg", "image/jpg"]);

/** Whether a file of this type/size is worth re-encoding (raster + big enough). */
export function shouldCompress(mime: string, byteLength: number): boolean {
  return COMPRESSIBLE.has(mime.toLowerCase()) && byteLength >= MIN_BYTES;
}

/**
 * Scale (w,h) so the long edge is ≤ maxEdge, preserving aspect ratio. Never
 * upscales; returns integer dimensions ≥ 1.
 */
export function targetDimensions(
  w: number,
  h: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge || longEdge === 0) return { width: w, height: h };
  const scale = maxEdge / longEdge;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Compress a raster image File to WebP, capped at MAX_EDGE. Returns the original
 * File unchanged when it isn't worth compressing, the environment has no canvas,
 * re-encoding fails, or the result isn't actually smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file.type, file.size)) return file;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = targetDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // no real gain → keep original
    const name = file.name.replace(/\.\w+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
