import { describe, expect, it } from "vitest";
import {
  editDistanceWithin,
  gradeWritten,
  toggleQuestionKind,
  typoAllowance,
} from "@/lib/questionTypes";

describe("gradeWritten without typo tolerance (the quiz)", () => {
  it("still credits exact matches and alternatives", () => {
    expect(gradeWritten("Elephant", "elephant")).toBe(true);
    expect(gradeWritten("large", "big / large")).toBe(true);
  });

  it("does not credit a typo", () => {
    expect(gradeWritten("elephnat", "elephant")).toBe(false);
  });
});

describe("gradeWritten with typo tolerance (Learn's smart grading)", () => {
  const smart = { typoTolerant: true };

  it("credits one slip in a medium-length answer", () => {
    expect(gradeWritten("elephnat", "elephant", smart)).toBe(true); // swapped letters
    expect(gradeWritten("recieve", "receive", smart)).toBe(true);
    expect(gradeWritten("helo there", "hello there", smart)).toBe(true); // 11 chars → 2 allowed
  });

  it("does not credit two slips in a medium-length answer", () => {
    expect(gradeWritten("elefant", "elephant", smart)).toBe(false);
  });

  it("credits two slips in a long answer, but not three", () => {
    expect(gradeWritten("responsibilty", "responsibility", smart)).toBe(true);
    expect(gradeWritten("resposibilty", "responsibility", smart)).toBe(true);
    expect(gradeWritten("resposbilty", "responsibility", smart)).toBe(false);
  });

  it("never loosens short answers", () => {
    expect(gradeWritten("cot", "cat", smart)).toBe(false);
    expect(gradeWritten("たべろ", "たべる", smart)).toBe(false);
  });

  it("checks each alternative on its own", () => {
    expect(gradeWritten("lrage", "big / large", smart)).toBe(true);
  });

  it("still rejects a blank answer", () => {
    expect(gradeWritten("  ", "elephant", smart)).toBe(false);
  });
});

describe("typoAllowance", () => {
  it("scales with the answer's length in characters", () => {
    expect(typoAllowance("abcd")).toBe(0);
    expect(typoAllowance("abcde")).toBe(1);
    expect(typoAllowance("abcdefgh")).toBe(1);
    expect(typoAllowance("abcdefghi")).toBe(2);
    expect(typoAllowance("ありがとう")).toBe(1); // 5 kana
  });
});

describe("editDistanceWithin", () => {
  it("counts insertions, deletions, substitutions and neighbour swaps as one edit", () => {
    expect(editDistanceWithin("kitten", "kitten", 0)).toBe(true);
    expect(editDistanceWithin("kiten", "kitten", 1)).toBe(true);
    expect(editDistanceWithin("kittten", "kitten", 1)).toBe(true);
    expect(editDistanceWithin("sitten", "kitten", 1)).toBe(true);
    expect(editDistanceWithin("iktten", "kitten", 1)).toBe(true);
  });

  it("rejects anything beyond the limit", () => {
    expect(editDistanceWithin("sittin", "kitten", 1)).toBe(false);
    expect(editDistanceWithin("kit", "kitten", 2)).toBe(false);
  });
});

describe("toggleQuestionKind", () => {
  it("adds a format in canonical order", () => {
    expect(toggleQuestionKind(["written"], "mcq")).toEqual(["mcq", "written"]);
  });

  it("removes a format", () => {
    expect(toggleQuestionKind(["mcq", "truefalse"], "mcq")).toEqual(["truefalse"]);
  });

  it("never switches off the last format", () => {
    const only: ("mcq" | "truefalse" | "written")[] = ["written"];
    expect(toggleQuestionKind(only, "written")).toBe(only);
  });
});
