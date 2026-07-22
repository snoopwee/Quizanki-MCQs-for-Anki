import { describe, expect, it } from "vitest";
import type { Flashcard } from "@/lib/flashcards";
import {
  buildMatchTiles,
  formatMatchTime,
  isMatch,
  matchableCards,
  type MatchTile,
} from "@/lib/matchGame";

function makeRng(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const card = (id: string, front: string[], back: string[]): Flashcard => ({
  id,
  front,
  back,
  noteType: "Basic",
});

const deck: Flashcard[] = [
  card("1", ["a"], ["A"]),
  card("2", ["b"], ["B"]),
  card("3", ["c"], ["C"]),
  card("4", [""], ["D"]), // no term — not playable
  card("5", ["e"], ["   "]), // whitespace-only definition — not playable
];

describe("matchableCards", () => {
  it("keeps only cards with both a term and a definition", () => {
    expect(matchableCards(deck).map((c) => c.id)).toEqual(["1", "2", "3"]);
  });
});

describe("buildMatchTiles", () => {
  it("makes a front + back tile per picked card, capped at the pair count", () => {
    const tiles = buildMatchTiles(deck, 2, makeRng());
    expect(tiles).toHaveLength(4);
    expect(tiles.filter((t) => t.face === "front")).toHaveLength(2);
    expect(tiles.filter((t) => t.face === "back")).toHaveLength(2);
  });

  it("caps the pair count at the number of playable cards", () => {
    // 3 playable cards, asked for 6 → 3 pairs → 6 tiles.
    const tiles = buildMatchTiles(deck, 6, makeRng());
    expect(tiles).toHaveLength(6);
    expect(tiles.every((t) => t.text.trim().length > 0)).toBe(true);
  });

  it("returns an empty board when fewer than two pairs are available", () => {
    expect(buildMatchTiles([deck[0]], 6, makeRng())).toHaveLength(0);
  });

  it("gives every tile a unique id even when card ids repeat (cloze)", () => {
    const cloze: Flashcard[] = [
      card("n1", ["x1"], ["y1"]),
      card("n1", ["x2"], ["y2"]), // same note id, different cloze
    ];
    const tiles = buildMatchTiles(cloze, 2, makeRng());
    expect(new Set(tiles.map((t) => t.tileId)).size).toBe(4);
    expect(new Set(tiles.map((t) => t.cardId)).size).toBe(2);
  });

  it("is deterministic for a given rng", () => {
    const a = buildMatchTiles(deck, 3, makeRng(7));
    const b = buildMatchTiles(deck, 3, makeRng(7));
    expect(a.map((t) => t.tileId)).toEqual(b.map((t) => t.tileId));
  });
});

describe("isMatch", () => {
  const tile = (cardId: string, face: "front" | "back"): MatchTile => ({
    tileId: `${cardId}:${face}`,
    cardId,
    face,
    text: "",
  });

  it("is true for the two faces of one card", () => {
    expect(isMatch(tile("k", "front"), tile("k", "back"))).toBe(true);
  });

  it("is false for two tiles of the same face", () => {
    expect(isMatch(tile("k", "front"), tile("k", "front"))).toBe(false);
  });

  it("is false across different cards", () => {
    expect(isMatch(tile("k1", "front"), tile("k2", "back"))).toBe(false);
  });
});

describe("formatMatchTime", () => {
  it("shows sub-minute times in seconds with one decimal", () => {
    expect(formatMatchTime(12300)).toBe("12.3s");
    expect(formatMatchTime(5300)).toBe("5.3s");
  });

  it("shows a minute or more as m:ss.d", () => {
    expect(formatMatchTime(65300)).toBe("1:05.3");
    expect(formatMatchTime(125000)).toBe("2:05.0");
  });

  it("clamps negatives to zero", () => {
    expect(formatMatchTime(-100)).toBe("0.0s");
  });
});
