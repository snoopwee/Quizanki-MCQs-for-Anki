import { describe, expect, it } from "vitest";
import { buildQuestions, reshuffleQuestions, type QuizNote } from "@/lib/buildQuestions";

const deck: QuizNote[] = [
  { id: "1", fields: { q: "食べる", a: "to eat" } },
  { id: "2", fields: { q: "飲む", a: "to drink" } },
  { id: "3", fields: { q: "行く", a: "to go" } },
  { id: "4", fields: { q: "見る", a: "to see" } },
  { id: "5", fields: { q: "話す", a: "to speak" } },
];

const config = { questionFields: ["q"], answerField: "a" };
const rng = () => 0; // deterministic

describe("buildQuestions", () => {
  it("builds the requested number of 4-option questions including the correct answer", () => {
    const questions = buildQuestions(deck, 3, config, deck, rng);
    expect(questions).toHaveLength(3);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.correct);
      expect(new Set(q.options).size).toBe(4); // no duplicate options
    }
  });

  it("excludes the correct answer from distractors and dedupes the pool", () => {
    const dupDeck: QuizNote[] = [
      { id: "1", fields: { q: "a", a: "to eat" } },
      { id: "2", fields: { q: "b", a: "to eat" } }, // duplicate answer
      { id: "3", fields: { q: "c", a: "to drink" } },
      { id: "4", fields: { q: "d", a: "to go" } },
      { id: "5", fields: { q: "e", a: "to see" } },
    ];
    const questions = buildQuestions(dupDeck, 5, config, dupDeck, rng);
    const eat = questions.find((q) => q.correct === "to eat")!;
    const distractors = eat.options.filter((o) => o !== "to eat");
    expect(distractors).not.toContain("to eat");
    expect(new Set(distractors).size).toBe(distractors.length);
  });

  it("bundles multiple question fields into a labelled prompt, dropping empties", () => {
    const bundleDeck: QuizNote[] = [
      { id: "1", fields: { term: "提案", reading: "ていあん", example: "新しい提案", a: "proposal" } },
      { id: "2", fields: { term: "会議", reading: "かいぎ", example: "", a: "meeting" } },
    ];
    const questions = buildQuestions(
      bundleDeck,
      2,
      { questionFields: ["term", "reading", "example"], answerField: "a" },
      bundleDeck,
      rng,
    );
    const teian = questions.find((q) => q.correct === "proposal")!;
    expect(teian.prompt.map((s) => s.label)).toEqual(["term", "reading", "example"]);
    expect(teian.prompt.map((s) => s.value)).toEqual(["提案", "ていあん", "新しい提案"]);
    expect(teian.question).toBe("提案 — ていあん — 新しい提案");

    // The empty "example" field is dropped from this note's prompt.
    const kaigi = questions.find((q) => q.correct === "meeting")!;
    expect(kaigi.prompt.map((s) => s.label)).toEqual(["term", "reading"]);
  });

  it("reshuffles option positions and question order without changing content", () => {
    const original = buildQuestions(deck, 5, config, deck, rng);
    // A non-trivial rng so the shuffle actually moves things (rng=0 is a no-op).
    let seed = 0;
    const varyRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const reshuffled = reshuffleQuestions(original, varyRng);

    // Same questions, same per-question option membership and correct answer.
    expect(reshuffled).toHaveLength(original.length);
    for (const q of original) {
      const match = reshuffled.find((r) => r.noteId === q.noteId)!;
      expect(match.correct).toBe(q.correct);
      expect([...match.options].sort()).toEqual([...q.options].sort());
    }

    // ...but at least one question's option order actually changed.
    const someOrderChanged = original.some((q) => {
      const match = reshuffled.find((r) => r.noteId === q.noteId)!;
      return match.options.join("|") !== q.options.join("|");
    });
    expect(someOrderChanged).toBe(true);
  });

  it("degrades gracefully when the answer pool has fewer than 4 unique values", () => {
    const tiny: QuizNote[] = [
      { id: "1", fields: { q: "a", a: "x" } },
      { id: "2", fields: { q: "b", a: "y" } },
    ];
    const questions = buildQuestions(tiny, 2, config, tiny, rng);
    expect(questions[0].options.length).toBeLessThanOrEqual(2);
    expect(questions[0].options).toContain(questions[0].correct);
  });
});
