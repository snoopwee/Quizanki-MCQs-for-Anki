import { describe, expect, it } from "vitest";
import { buildQuestions, type QuizNote } from "@/lib/buildQuestions";

const deck: QuizNote[] = [
  { id: "1", fields: { q: "食べる", a: "to eat" } },
  { id: "2", fields: { q: "飲む", a: "to drink" } },
  { id: "3", fields: { q: "行く", a: "to go" } },
  { id: "4", fields: { q: "見る", a: "to see" } },
  { id: "5", fields: { q: "話す", a: "to speak" } },
];

const config = { questionField: "q", answerField: "a" as const };
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

  it("swaps prompt and answer for BACK_TO_FRONT direction", () => {
    const questions = buildQuestions(
      deck,
      1,
      { ...config, direction: "BACK_TO_FRONT" },
      deck,
      rng,
    );
    const q = questions[0];
    const source = deck.find((n) => n.id === q.noteId)!;
    expect(q.question).toBe(source.fields.a);
    expect(q.correct).toBe(source.fields.q);
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
