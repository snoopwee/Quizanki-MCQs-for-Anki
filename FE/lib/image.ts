// Client-side image helpers for the profile picture. The user frames a circle in
// an interactive cropper (free drag + zoom over a blank canvas — the image can be
// placed anywhere, even leaving empty space); we render that square region to a
// small JPEG before upload, so avatars are consistent, cheap to store, and fast
// to load. The geometry is factored into the pure functions below so it can be
// unit-tested without a DOM.

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

// Upper bound on the *source* file the user picks (we downscale after this).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
// Output edge length + JPEG quality of the square we upload.
export const AVATAR_SIZE = 256;
export const AVATAR_QUALITY = 0.85;

/** Validate a picked file. Returns an error message, or null when it's fine. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) {
    return "Please choose a PNG, JPG or WebP image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That image is too large — pick one under 8 MB.";
  }
  return null;
}

// --- cropper geometry (pure) -----------------------------------------------

/** Scale that fits the whole image inside a box (contain) — the cropper's zoom 1. */
export function containScale(imgW: number, imgH: number, boxW: number, boxH: number): number {
  return Math.min(boxW / imgW, boxH / imgH);
}

/**
 * The source-pixel square framed by the crop circle. `cropX/cropY` is the crop
 * square's top-left in stage coords, `offsetX/offsetY` the image's top-left; both
 * are unclamped (free positioning), so the rect may extend past the image — the
 * blank part is filled in when drawn.
 */
export function cropToSourceRect(
  cropX: number,
  cropY: number,
  cropSize: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): { sx: number; sy: number; size: number } {
  return {
    sx: (cropX - offsetX) / scale,
    sy: (cropY - offsetY) / scale,
    size: cropSize / scale,
  };
}

/**
 * Clip a (possibly out-of-bounds) source square to the image and compute the
 * matching destination rect on an out×out canvas. Returns null when the square
 * misses the image entirely — the whole output is then just the blank fill.
 */
export function clippedDrawRect(
  rect: { sx: number; sy: number; size: number },
  imgW: number,
  imgH: number,
  out: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } | null {
  const scale = out / rect.size; // destination px per source px
  const ix0 = Math.max(rect.sx, 0);
  const iy0 = Math.max(rect.sy, 0);
  const ix1 = Math.min(rect.sx + rect.size, imgW);
  const iy1 = Math.min(rect.sy + rect.size, imgH);
  if (ix1 <= ix0 || iy1 <= iy0) return null;
  return {
    sx: ix0,
    sy: iy0,
    sw: ix1 - ix0,
    sh: iy1 - iy0,
    dx: (ix0 - rect.sx) * scale,
    dy: (iy0 - rect.sy) * scale,
    dw: (ix1 - ix0) * scale,
    dh: (iy1 - iy0) * scale,
  };
}

// --- canvas rendering (browser-only) ---------------------------------------

/**
 * Render the framed square region of `source` to an out×out JPEG blob, filling
 * any area the image doesn't cover with `background` (so free-positioned blanks
 * come out clean instead of black).
 */
export async function drawRegionToBlob(
  source: CanvasImageSource,
  imgW: number,
  imgH: number,
  rect: { sx: number; sy: number; size: number },
  out = AVATAR_SIZE,
  quality = AVATAR_QUALITY,
  background = "#ffffff",
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images here.");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";

  const d = clippedDrawRect(rect, imgW, imgH, out);
  if (d) ctx.drawImage(source, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Couldn't process that image.");
  return blob;
}
