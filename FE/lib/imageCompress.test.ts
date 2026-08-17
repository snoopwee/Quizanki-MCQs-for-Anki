import { describe, it, expect } from "vitest";
import { shouldCompress, targetDimensions, compressImage } from "./imageCompress";

describe("shouldCompress", () => {
  const big = 100 * 1024;
  it("compresses big PNG/JPEG (case-insensitive)", () => {
    expect(shouldCompress("image/png", big)).toBe(true);
    expect(shouldCompress("image/jpeg", big)).toBe(true);
    expect(shouldCompress("image/jpg", big)).toBe(true);
    expect(shouldCompress("IMAGE/PNG", big)).toBe(true);
  });
  it("skips tiny images (not worth re-encoding)", () => {
    expect(shouldCompress("image/png", 1024)).toBe(false);
  });
  it("skips gif / webp / svg / others — never flattens an animated GIF", () => {
    expect(shouldCompress("image/gif", big)).toBe(false);
    expect(shouldCompress("image/webp", big)).toBe(false);
    expect(shouldCompress("image/svg+xml", big)).toBe(false);
  });
});

describe("targetDimensions", () => {
  it("leaves images within the cap untouched", () => {
    expect(targetDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(targetDimensions(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });
  it("scales down preserving aspect ratio (long edge → cap)", () => {
    expect(targetDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(targetDimensions(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it("never upscales and handles zero", () => {
    expect(targetDimensions(100, 100, 1600)).toEqual({ width: 100, height: 100 });
    expect(targetDimensions(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("compressImage", () => {
  it("passes a non-compressible file through untouched", async () => {
    const gif = new File([new Uint8Array(100 * 1024)], "a.gif", { type: "image/gif" });
    expect(await compressImage(gif)).toBe(gif);
  });
  it("passes through when no canvas is available (node/SSR), even for PNG", async () => {
    const png = new File([new Uint8Array(100 * 1024)], "a.png", { type: "image/png" });
    expect(await compressImage(png)).toBe(png);
  });
});
