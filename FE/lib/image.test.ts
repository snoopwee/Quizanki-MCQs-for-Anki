import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  MAX_UPLOAD_BYTES,
  containScale,
  cropToSourceRect,
  clippedDrawRect,
} from "./image";

describe("validateImageFile", () => {
  it("accepts PNG, JPEG and WebP under the size cap", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("rejects unsupported types", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toMatch(/PNG, JPG or WebP/);
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).toMatch(/PNG, JPG or WebP/);
    expect(validateImageFile({ type: "", size: 1000 })).toMatch(/PNG, JPG or WebP/);
  });

  it("rejects files over the size cap", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/too large/);
  });

  it("accepts a file exactly at the size cap", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_UPLOAD_BYTES })).toBeNull();
  });
});

describe("containScale", () => {
  it("fits the whole image inside the box (shorter fit wins)", () => {
    expect(containScale(200, 100, 300, 300)).toBeCloseTo(1.5); // min(1.5, 3)
    expect(containScale(100, 200, 300, 300)).toBeCloseTo(1.5);
    expect(containScale(100, 100, 300, 300)).toBe(3);
  });
});

describe("cropToSourceRect", () => {
  it("maps the crop square to source pixels at zoom 1", () => {
    // crop at (50,50) size 200, image at origin, scale 2 → source (25,25) size 100
    expect(cropToSourceRect(50, 50, 200, 2, 0, 0)).toEqual({ sx: 25, sy: 25, size: 100 });
  });

  it("accounts for a freely-dragged image offset", () => {
    expect(cropToSourceRect(50, 50, 200, 2, 10, 20)).toEqual({ sx: 20, sy: 15, size: 100 });
  });
});

describe("clippedDrawRect", () => {
  it("passes a fully-in-bounds square straight through, scaled to the output", () => {
    const d = clippedDrawRect({ sx: 25, sy: 25, size: 100 }, 200, 200, 256);
    expect(d).toEqual({ sx: 25, sy: 25, sw: 100, sh: 100, dx: 0, dy: 0, dw: 256, dh: 256 });
  });

  it("clips a square that hangs off the left and offsets the destination (blank fill)", () => {
    // half the crop is left of the image → image drawn on the right half of the output
    const d = clippedDrawRect({ sx: -50, sy: 0, size: 100 }, 200, 200, 256);
    expect(d).toEqual({ sx: 0, sy: 0, sw: 50, sh: 100, dx: 128, dy: 0, dw: 128, dh: 256 });
  });

  it("returns null when the crop square misses the image entirely", () => {
    expect(clippedDrawRect({ sx: 300, sy: 0, size: 100 }, 200, 200, 256)).toBeNull();
  });
});
