import { describe, expect, it } from "vitest";
import {
  answeredCount,
  clampIndex,
  gradePracticeAnswer,
  gradePracticeTest,
  unansweredIndexes,
} from "./practiceTest";
import type { Question } from "@/lib/buildQuestions";

function mcq(correct: string, options: string[]): Question {
  return {
    kind: "mcq",
    noteId: `n-${correct}`,
    question: "Q",
    prompt: [{ label: "Front", value: "Q" }],
    correct,
    options,
  };
}

function truefalse(truth: boolean): Question {
  return {
    kind: "truefalse",
    noteId: "tf",
    question: "Q",
    prompt: [{ label: "Front", value: "Q" }],
    correct: "x",
    statement: "A claim",
    truth,
  };
}

function written(correct: string): Question {
  return {
    kind: "written",
    noteId: "w",
    question: "Q",
    prompt: [{ label: "Front", value: "Q" }],
    correct,
  };
}

describe("gradePracticeAnswer", () => {
  it("grades multiple choice by exact option", () => {
    const q = mcq("Right", ["Right", "Wrong"]);
    expect(gradePracticeAnswer(q, "Right")).toBe(true);
    expect(gradePracticeAnswer(q, "Wrong")).toBe(false);
  });

  it("grades true/false against the claim's truth", () => {
    expect(gradePracticeAnswer(truefalse(true), "True")).toBe(true);
    expect(gradePracticeAnswer(truefalse(true), "False")).toBe(false);
    expect(gradePracticeAnswer(truefalse(false), "False")).toBe(true);
  });

  it("grades a typed answer with the shared matcher", () => {
    const q = written("mitochondrion");
    expect(gradePracticeAnswer(q, "mitochondrion")).toBe(true);
    expect(gradePracticeAnswer(q, "  Mitochondrion  ")).toBe(true);
  });

  it("does NOT forgive typos — smart grading is a Learn affordance, not a test one", () => {
    expect(gradePracticeAnswer(written("mitochondrion"), "mitochondrian")).toBe(false);
  });

  it("counts a blank as wrong without throwing", () => {
    expect(gradePracticeAnswer(mcq("Right", ["Right"]), null)).toBe(false);
  });
});

describe("gradePracticeTest", () => {
  const paper = [mcq("A", ["A", "B"]), mcq("C", ["C", "D"]), truefalse(true)];

  it("scores the paper", () => {
    const s = gradePracticeTest(paper, ["A", "D", "True"]);
    expect(s.correct).toBe(2);
    expect(s.total).toBe(3);
    expect(s.percent).toBe(67);
    expect(s.blanks).toBe(0);
  });

  it("marks blanks as blank AND wrong, so they lower the score but read differently", () => {
    const s = gradePracticeTest(paper, ["A", null, null]);
    expect(s.correct).toBe(1);
    expect(s.blanks).toBe(2);
    expect(s.results[1]!.blank).toBe(true);
    expect(s.results[1]!.correct).toBe(false);
  });

  it("treats a whitespace-only typed answer as blank, not as a wrong answer", () => {
    const s = gradePracticeTest([written("cell")], ["   "]);
    expect(s.blanks).toBe(1);
    expect(s.correct).toBe(0);
  });

  it("survives an answers array shorter than the paper", () => {
    // Only a bug produces this; a thrown error would hide which question went missing.
    const s = gradePracticeTest(paper, ["A"]);
    expect(s.total).toBe(3);
    expect(s.blanks).toBe(2);
  });

  it("reports 0% rather than NaN for an empty paper", () => {
    const s = gradePracticeTest([], []);
    expect(s.percent).toBe(0);
    expect(s.total).toBe(0);
  });

  it("rounds the percentage to a whole number", () => {
    expect(gradePracticeTest(paper, ["A", "C", "False"]).percent).toBe(67);
    expect(gradePracticeTest(paper, ["A", "C", "True"]).percent).toBe(100);
  });
});

describe("answeredCount / unansweredIndexes", () => {
  it("counts only real responses", () => {
    expect(answeredCount(["A", null, "B"], 3)).toBe(2);
    expect(answeredCount([], 3)).toBe(0);
  });

  it("does not count whitespace as an answer", () => {
    expect(answeredCount(["   ", "A"], 2)).toBe(1);
  });

  it("lists the blanks in order, which is what 'jump to the first unanswered' needs", () => {
    expect(unansweredIndexes(["A", null, "", "B", null], 5)).toEqual([1, 2, 4]);
  });

  it("treats a short array as all-blank beyond its end", () => {
    expect(unansweredIndexes(["A"], 3)).toEqual([1, 2]);
  });
});

describe("clampIndex", () => {
  it("clamps instead of wrapping — a paper has a visible end", () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(5, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
  });

  it("never returns a negative index for an empty paper", () => {
    expect(clampIndex(3, 0)).toBe(0);
  });
});
