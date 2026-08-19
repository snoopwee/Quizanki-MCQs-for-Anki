import { describe, it, expect } from "vitest";
import { sha256Hex, existingMedia, mapWithConcurrency } from "./mediaUpload";

describe("sha256Hex", () => {
  it("matches known SHA-256 vectors (lowercase hex) — must equal the backend's", async () => {
    expect(await sha256Hex(new TextEncoder().encode(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes only a view's own bytes, not its backing buffer", async () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(2, 4); // [3,4]
    expect(await sha256Hex(view)).toBe(await sha256Hex(new Uint8Array([3, 4])));
  });
});

describe("existingMedia", () => {
  it("skips the round-trip on an empty input", async () => {
    expect(await existingMedia([])).toEqual(new Map());
  });
});

describe("mapWithConcurrency", () => {
  it("runs every item and never exceeds the limit in flight", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await mapWithConcurrency(items, 4, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      seen.push(n);
      inFlight--;
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("handles fewer items than the limit", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2], 8, async (n) => void seen.push(n));
    expect(seen.sort()).toEqual([1, 2]);
  });
});
