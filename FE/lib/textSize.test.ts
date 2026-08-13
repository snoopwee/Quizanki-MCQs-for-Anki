import { describe, it, expect, afterEach, vi } from "vitest";
import {
  applyTextSize,
  clampTextSize,
  readTextSize,
  storeTextSize,
  TEXT_SIZE_DEFAULT,
  TEXT_SIZE_INIT_SCRIPT,
  TEXT_SIZE_KEY,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
} from "./textSize";

// Runs in the "node" environment (see vitest.config.ts), so there's no
// window/localStorage/document — stub minimal ones, same approach as theme.test.
function makeLocalStorage(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

function stubWindow(val?: string) {
  const ls = makeLocalStorage(val != null ? { [TEXT_SIZE_KEY]: val } : undefined);
  vi.stubGlobal("window", { localStorage: ls });
  return ls;
}

function stubDocument() {
  const el = { style: { fontSize: "" } };
  vi.stubGlobal("document", { documentElement: el });
  return el;
}

describe("textSize", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("clampTextSize", () => {
    it("keeps values inside the range", () => {
      expect(clampTextSize(TEXT_SIZE_MIN)).toBe(TEXT_SIZE_MIN);
      expect(clampTextSize(115)).toBe(115);
      expect(clampTextSize(TEXT_SIZE_MAX)).toBe(TEXT_SIZE_MAX);
    });
    it("clamps out-of-range values to the bounds", () => {
      expect(clampTextSize(80)).toBe(TEXT_SIZE_MIN);
      expect(clampTextSize(999)).toBe(TEXT_SIZE_MAX);
    });
    it("parses numeric strings", () => {
      expect(clampTextSize("110")).toBe(110);
    });
    it("falls back to the default on non-numbers", () => {
      expect(clampTextSize("banana")).toBe(TEXT_SIZE_DEFAULT);
      expect(clampTextSize(null)).toBe(TEXT_SIZE_DEFAULT);
      expect(clampTextSize(undefined)).toBe(TEXT_SIZE_DEFAULT);
      expect(clampTextSize(NaN)).toBe(TEXT_SIZE_DEFAULT);
    });
  });

  describe("readTextSize", () => {
    it("returns the default on the server (no window)", () => {
      expect(readTextSize()).toBe(TEXT_SIZE_DEFAULT);
    });
    it("returns the default when nothing is stored", () => {
      stubWindow();
      expect(readTextSize()).toBe(TEXT_SIZE_DEFAULT);
    });
    it("returns the stored size", () => {
      stubWindow("115");
      expect(readTextSize()).toBe(115);
    });
    it("clamps a stored out-of-range size", () => {
      stubWindow("400");
      expect(readTextSize()).toBe(TEXT_SIZE_MAX);
    });
    it("falls back to the default on a corrupt value", () => {
      stubWindow("banana");
      expect(readTextSize()).toBe(TEXT_SIZE_DEFAULT);
    });
  });

  describe("storeTextSize", () => {
    it("persists a clamped size", () => {
      const ls = stubWindow();
      storeTextSize(120);
      expect(ls.getItem(TEXT_SIZE_KEY)).toBe("120");
      storeTextSize(999);
      expect(ls.getItem(TEXT_SIZE_KEY)).toBe(String(TEXT_SIZE_MAX));
    });
  });

  describe("applyTextSize", () => {
    it("writes the size as a percent onto the root element", () => {
      const el = stubDocument();
      applyTextSize(120);
      expect(el.style.fontSize).toBe("120%");
      applyTextSize(100);
      expect(el.style.fontSize).toBe("100%");
    });
    it("clamps before applying", () => {
      const el = stubDocument();
      applyTextSize(1000);
      expect(el.style.fontSize).toBe(`${TEXT_SIZE_MAX}%`);
    });
    it("no-ops on the server (no document)", () => {
      expect(() => applyTextSize(110)).not.toThrow();
    });
  });

  describe("TEXT_SIZE_INIT_SCRIPT", () => {
    it("embeds the key + bounds so it can apply before first paint", () => {
      expect(TEXT_SIZE_INIT_SCRIPT).toContain(TEXT_SIZE_KEY);
      expect(TEXT_SIZE_INIT_SCRIPT).toContain("documentElement.style.fontSize");
      expect(TEXT_SIZE_INIT_SCRIPT).toContain(String(TEXT_SIZE_MAX));
    });
  });
});
