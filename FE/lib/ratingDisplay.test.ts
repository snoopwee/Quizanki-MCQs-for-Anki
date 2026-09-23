import { describe, expect, it } from "vitest";
import {
  canRate,
  formatAverage,
  ratingCaption,
  ratingLabel,
  ratingSummary,
  starFills,
  STARS,
} from "./ratingDisplay";

describe("starFills", () => {
  it("always returns five stars", () => {
    expect(starFills(0)).toHaveLength(STARS);
    expect(starFills(4.2)).toHaveLength(STARS);
  });

  it("fills from three-quarters and halves from a quarter", () => {
    // 4.2 is four stars, not four and a half — the number beside them carries the detail.
    expect(starFills(4.2)).toEqual(["full", "full", "full", "full", "empty"]);
    expect(starFills(4.3)).toEqual(["full", "full", "full", "full", "half"]);
    expect(starFills(4.8)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(0.5)).toEqual(["half", "empty", "empty", "empty", "empty"]);
  });

  it("shows nothing for an unrated deck", () => {
    expect(starFills(0)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });

  it("clamps nonsense instead of rendering six stars or negative ones", () => {
    expect(starFills(9)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(-2)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
    expect(starFills(Number.NaN)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });
});

describe("formatAverage", () => {
  it("always keeps one decimal, including the .0", () => {
    // A column of deck cards reading 4.2 / 5.0 / 3.8 lines up where 4.2 / 5 / 3.8 looks ragged.
    expect(formatAverage(4.2)).toBe("4.2");
    expect(formatAverage(4.25)).toBe("4.3");
    expect(formatAverage(5)).toBe("5.0");
  });

  it("prints 0.0 for no score, because the score is shown before anybody rates", () => {
    expect(formatAverage(0)).toBe("0.0");
    expect(formatAverage(-1)).toBe("0.0");
    expect(formatAverage(Number.NaN)).toBe("0.0");
  });

  it("clamps above five rather than printing a sixth star's worth", () => {
    expect(formatAverage(9)).toBe("5.0");
  });
});

describe("ratingSummary", () => {
  it("reads as the whole score in one string", () => {
    // No "stars": the glyphs beside it already say that, and the word cost a line on a deck card.
    expect(ratingSummary(4.2, 17)).toBe("4.2 (17)");
    expect(ratingSummary(5, 1)).toBe("5.0 (1)");
  });

  it("says 0.0 (0) for a deck nobody has rated", () => {
    // Not blank and not hidden: an unrated deck is a fact about the deck.
    expect(ratingSummary(0, 0)).toBe("0.0 (0)");
    // A count of zero wins over a stale average.
    expect(ratingSummary(4.5, 0)).toBe("0.0 (0)");
  });
});

describe("ratingCaption", () => {
  it("counts raters, singular included", () => {
    expect(ratingCaption(0)).toBe("Not rated yet");
    expect(ratingCaption(1)).toBe("1 rating");
    expect(ratingCaption(12)).toBe("12 ratings");
  });
});

describe("ratingLabel", () => {
  it("says the score out loud rather than leaving five glyphs", () => {
    expect(ratingLabel(4.2, 17)).toBe("Rated 4.2 out of 5, 17 ratings");
    expect(ratingLabel(0, 0)).toBe("Not rated yet");
  });
});

describe("canRate", () => {
  it("is offered to a signed-in stranger only", () => {
    expect(canRate({ signedIn: true, isOwner: false })).toBe(true);
    // Your own deck — the backend refuses this too, with a 409.
    expect(canRate({ signedIn: true, isOwner: true })).toBe(false);
    // A guest has nowhere to store a rating.
    expect(canRate({ signedIn: false, isOwner: false })).toBe(false);
  });
});
