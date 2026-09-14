import { describe, expect, it } from "vitest";
import type { McqQuestion, TrueFalseQuestion, WrittenQuestion } from "@/lib/buildQuestions";
import {
  answerHint,
  isAnswerCorrect,
  trueFalseLabel,
  writtenIsCorrect,
} from "@/lib/questionAnswer";

const base = { noteId: "n1", prompt: [{ label: "Front", value: "犬" }], question: "犬", correct: "dog" };
const mcq: McqQuestion = { ...base, kind: "mcq", options: ["cat", "dog", "bird", "fish"] };
const tfFalse: TrueFalseQuestion = { ...base, kind: "truefalse", statement: "cat", truth: false };
const tfTrue: TrueFalseQuestion = { ...base, kind: "truefalse", statement: "dog", truth: true };
const written: WrittenQuestion = { ...base, kind: "written" };

describe("trueFalseLabel", () => {
  it("labels a pick the way it is recorded", () => {
    expect(trueFalseLabel(true)).toBe("True");
    expect(trueFalseLabel(false)).toBe("False");
  });
});

describe("writtenIsCorrect", () => {
  it("never counts an unchecked answer", () => {
    expect(writtenIsCorrect(null)).toBe(false);
  });

  it("counts an auto-graded match", () => {
    expect(writtenIsCorrect({ autoCorrect: true, override: false })).toBe(true);
  });

  it("counts a miss the learner overrode", () => {
    expect(writtenIsCorrect({ autoCorrect: false, override: true })).toBe(true);
  });

  it("does not count a miss without an override", () => {
    expect(writtenIsCorrect({ autoCorrect: false, override: false })).toBe(false);
  });
});

describe("isAnswerCorrect", () => {
  it("multiple choice: right only when the pick is the correct option", () => {
    expect(isAnswerCorrect(mcq, "dog", null)).toBe(true);
    expect(isAnswerCorrect(mcq, "cat", null)).toBe(false);
    expect(isAnswerCorrect(mcq, null, null)).toBe(false);
  });

  it("true/false: right when the verdict matches the statement's truth", () => {
    expect(isAnswerCorrect(tfFalse, "False", null)).toBe(true);
    expect(isAnswerCorrect(tfFalse, "True", null)).toBe(false);
    expect(isAnswerCorrect(tfTrue, "True", null)).toBe(true);
    expect(isAnswerCorrect(tfTrue, "False", null)).toBe(false);
  });

  it("true/false: the correct answer text itself is not a verdict", () => {
    expect(isAnswerCorrect(tfTrue, "dog", null)).toBe(false);
  });

  it("written: reads the checked result and ignores any pick", () => {
    expect(isAnswerCorrect(written, "dog", null)).toBe(false);
    expect(isAnswerCorrect(written, null, { autoCorrect: true, override: false })).toBe(true);
    expect(isAnswerCorrect(written, null, { autoCorrect: false, override: true })).toBe(true);
    expect(isAnswerCorrect(written, "dog", { autoCorrect: false, override: false })).toBe(false);
  });
});

describe("answerHint", () => {
  it("tells the learner what each format expects", () => {
    expect(answerHint("mcq")).toBe("Pick the closest answer");
    expect(answerHint("truefalse")).toBe("True or false?");
    expect(answerHint("written")).toBe("Type your answer");
  });
});
