import { describe, expect, it } from "vitest";
import {
  ALL_QUESTION_KINDS,
  assignQuestionKind,
  buildTrueFalseFace,
  normalizeWritten,
  acceptedAnswers,
  gradeWritten,
} from "@/lib/questionTypes";

// A deterministic rng that yields the given values in order, then repeats the
// last one — lets each test drive exactly the branches it cares about.
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("assignQuestionKind", () => {
  it("returns the only enabled kind", () => {
    expect(assignQuestionKind(["written"], seq(0.9))).toBe("written");
  });

  it("indexes into the enabled set by the rng", () => {
    const enabled = ALL_QUESTION_KINDS; // [mcq, truefalse, written]
    expect(assignQuestionKind(enabled, seq(0))).toBe("mcq");
    expect(assignQuestionKind(enabled, seq(0.5))).toBe("truefalse");
    expect(assignQuestionKind(enabled, seq(0.99))).toBe("written");
  });

  it("falls back to mcq when nothing is enabled", () => {
    expect(assignQuestionKind([], seq(0.4))).toBe("mcq");
  });
});

describe("buildTrueFalseFace", () => {
  it("asserts the correct answer (true) on a low coin flip", () => {
    const face = buildTrueFalseFace("cat", ["dog", "bird"], seq(0.1));
    expect(face).toEqual({ statement: "cat", truth: true });
  });

  it("asserts a distractor (false) on a high coin flip", () => {
    // first rng = 0.9 (>= 0.5 → false branch), second rng = 0 (pick pool[0])
    const face = buildTrueFalseFace("cat", ["dog", "bird"], seq(0.9, 0));
    expect(face).toEqual({ statement: "dog", truth: false });
  });

  it("always returns a true statement when there is no usable distractor", () => {
    expect(buildTrueFalseFace("cat", [], seq(0.9))).toEqual({ statement: "cat", truth: true });
    // a pool that only contains the correct answer collapses to no distractor
    expect(buildTrueFalseFace("cat", ["cat"], seq(0.9))).toEqual({ statement: "cat", truth: true });
  });
});

describe("normalizeWritten", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeWritten("  To   Eat ")).toBe("to eat");
  });

  it("strips terminal punctuation and quotes", () => {
    expect(normalizeWritten("“Hello!”")).toBe("hello");
    expect(normalizeWritten("food.")).toBe("food");
  });

  it("placeholders LaTeX to a stable marker (brackets stripped as punctuation)", () => {
    expect(normalizeWritten("\\(x^2\\)")).toBe("math");
  });
});

describe("acceptedAnswers", () => {
  it("splits slash/semicolon/newline alternatives and keeps the whole form", () => {
    expect(acceptedAnswers("big / large").sort()).toEqual(["big", "big large", "large"].sort());
    expect(acceptedAnswers("行く；いく").sort()).toEqual(["行く", "行く いく", "いく"].sort());
  });

  it("does NOT split on commas (sentence answers stay intact)", () => {
    expect(acceptedAnswers("well, then")).toEqual(["well then"]);
  });
});

describe("gradeWritten", () => {
  it("accepts an exact normalized match", () => {
    expect(gradeWritten("to eat", "to eat")).toBe(true);
    expect(gradeWritten("  TO EAT. ", "to eat")).toBe(true);
  });

  it("accepts any listed alternative", () => {
    expect(gradeWritten("large", "big / large")).toBe(true);
    expect(gradeWritten("big", "big / large")).toBe(true);
  });

  it("rejects a wrong answer and blank input", () => {
    expect(gradeWritten("drink", "to eat")).toBe(false);
    expect(gradeWritten("   ", "to eat")).toBe(false);
  });
});
