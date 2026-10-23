import { describe, expect, it } from "vitest";
import { quizKeyAction, quizKeyHint } from "./quizKeys";

const mcq = { kind: "mcq" as const, optionCount: 4, answered: false };

describe("quizKeyAction — multiple choice", () => {
  it("maps the visible A–D labels to their options", () => {
    expect(quizKeyAction("a", mcq)).toEqual({ type: "option", index: 0 });
    expect(quizKeyAction("B", mcq)).toEqual({ type: "option", index: 1 });
    expect(quizKeyAction("d", mcq)).toEqual({ type: "option", index: 3 });
  });

  it("also maps the digits, because people reach for whichever they saw", () => {
    expect(quizKeyAction("1", mcq)).toEqual({ type: "option", index: 0 });
    expect(quizKeyAction("4", mcq)).toEqual({ type: "option", index: 3 });
  });

  it("ignores a key past the end of THIS question's options", () => {
    expect(quizKeyAction("e", mcq)).toBeNull();
    expect(quizKeyAction("5", mcq)).toBeNull();
    // A two-option question must not accept C.
    expect(quizKeyAction("c", { ...mcq, optionCount: 2 })).toBeNull();
  });

  it("ignores 0 — there is no option zero, and the labels start at 1", () => {
    expect(quizKeyAction("0", mcq)).toBeNull();
  });

  it("ignores keys that belong to the browser or the page", () => {
    for (const k of ["Tab", "Escape", "Shift", "ArrowLeft", " ", "-", "/"]) {
      expect(quizKeyAction(k, mcq), k).toBeNull();
    }
  });
});

describe("quizKeyAction — true/false", () => {
  const tf = { kind: "truefalse" as const, optionCount: 2, answered: false };

  it("takes T and F", () => {
    expect(quizKeyAction("t", tf)).toEqual({ type: "truefalse", value: true });
    expect(quizKeyAction("F", tf)).toEqual({ type: "truefalse", value: false });
  });

  it("takes 1 and 2 as the same two choices", () => {
    expect(quizKeyAction("1", tf)).toEqual({ type: "truefalse", value: true });
    expect(quizKeyAction("2", tf)).toEqual({ type: "truefalse", value: false });
  });

  it("does not answer on an unrelated letter", () => {
    expect(quizKeyAction("a", tf)).toBeNull();
    expect(quizKeyAction("3", tf)).toBeNull();
  });
});

describe("quizKeyAction — written", () => {
  it("claims no key at all, because every one of them belongs to the input", () => {
    const written = { kind: "written" as const, optionCount: 0, answered: false };
    for (const k of ["a", "1", "t", "Enter", "ArrowRight"]) {
      expect(quizKeyAction(k, written), k).toBeNull();
    }
    // Still nothing once answered — the learner may be editing before committing.
    expect(quizKeyAction("Enter", { ...written, answered: true })).toBeNull();
  });
});

describe("quizKeyAction — after answering", () => {
  const answered = { ...mcq, answered: true };

  it("switches from answering to advancing", () => {
    expect(quizKeyAction("Enter", answered)).toEqual({ type: "advance" });
    expect(quizKeyAction("ArrowRight", answered)).toEqual({ type: "advance" });
  });

  it("stops accepting answers, so a stray key cannot overwrite a locked one", () => {
    expect(quizKeyAction("a", answered)).toBeNull();
    expect(quizKeyAction("2", answered)).toBeNull();
  });
});

describe("quizKeyHint", () => {
  it("tells the learner what the keys do, and changes once they have answered", () => {
    expect(quizKeyHint({ kind: "mcq", answered: false })).toBe("A–D or 1–4 to answer");
    expect(quizKeyHint({ kind: "truefalse", answered: false })).toBe("T / F to answer");
    expect(quizKeyHint({ kind: "mcq", answered: true })).toBe("Enter to continue");
  });

  it("says nothing for a written question, which has no shortcuts", () => {
    expect(quizKeyHint({ kind: "written", answered: false })).toBeNull();
    expect(quizKeyHint({ kind: "written", answered: true })).toBeNull();
  });
});
