import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadFlashcardProgress,
  saveFlashcardProgress,
  clearFlashcardProgress,
} from "./flashcardProgress";

const DECK = "deck-1";
const keyFor = (deck: string) => `quizanki:flashcard-progress:v1:${deck}`;

// The suite runs in the "node" environment (see vitest.config.ts), so there's no
// window/localStorage — stub a minimal in-memory one, same approach as the TTS
// tests use for speechSynthesis.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe("flashcardProgress", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeLocalStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty piles when nothing is stored", () => {
    expect(loadFlashcardProgress(DECK)).toEqual({ known: [], learn: [] });
  });

  it("round-trips saved piles", () => {
    saveFlashcardProgress(DECK, { known: [2, 5], learn: [0, 1] });
    expect(loadFlashcardProgress(DECK)).toEqual({ known: [2, 5], learn: [0, 1] });
  });

  it("scopes progress per deck", () => {
    saveFlashcardProgress(DECK, { known: [1], learn: [] });
    expect(loadFlashcardProgress("deck-2")).toEqual({ known: [], learn: [] });
  });

  it("clears stored progress", () => {
    saveFlashcardProgress(DECK, { known: [1], learn: [2] });
    clearFlashcardProgress(DECK);
    expect(loadFlashcardProgress(DECK)).toEqual({ known: [], learn: [] });
  });

  it("drops non-integer / malformed keys on load", () => {
    window.localStorage.setItem(
      keyFor(DECK),
      JSON.stringify({ known: [1, "2", 3.5, null, NaN], learn: "nope" }),
    );
    expect(loadFlashcardProgress(DECK)).toEqual({ known: [1], learn: [] });
  });

  it("falls back to empty on corrupt JSON", () => {
    window.localStorage.setItem(keyFor(DECK), "{not json");
    expect(loadFlashcardProgress(DECK)).toEqual({ known: [], learn: [] });
  });
});
