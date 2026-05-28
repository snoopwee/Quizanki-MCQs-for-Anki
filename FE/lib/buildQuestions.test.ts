import { describe, expect, it } from "vitest";
import {
  buildQuestions,
  reshuffleQuestions,
  selectQuizNotes,
  type QuizNote,
} from "@/lib/buildQuestions";

// Deterministic-but-non-trivial LCG so weighted sampling actually exercises
// different probabilities (Math.random's distribution is uneven across runs).
function makeRng(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

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

// Stats-bearing helper deck for selection tests.
function makeNotes(specs: Array<{ id: string; mastery?: number; timesSeen?: number }>): QuizNote[] {
  return specs.map(({ id, mastery, timesSeen }) => ({
    id,
    fields: { q: id, a: id },
    mastery,
    timesSeen,
  }));
}

describe("selectQuizNotes", () => {
  it("returns the whole deck shuffled when count >= notes.length", () => {
    const notes = makeNotes([{ id: "1" }, { id: "2" }, { id: "3" }]);
    const out = selectQuizNotes(notes, 10, makeRng());
    expect(new Set(out.map((n) => n.id))).toEqual(new Set(["1", "2", "3"]));
  });

  it("cold start: every pick comes from the new pool when no card has been seen", () => {
    // No timesSeen on any card → all new. With nothing else to study, the quiz
    // must consist entirely of new cards.
    const notes = makeNotes(
      Array.from({ length: 20 }, (_, i) => ({ id: `n${i}` })),
    );
    const picked = selectQuizNotes(notes, 10, makeRng());
    expect(picked).toHaveLength(10);
    // All picks must come from the input set.
    for (const p of picked) expect(notes.find((n) => n.id === p.id)).toBeDefined();
  });

  it("seen-but-none-ready: admits zero new cards, all picks come from seen pool", () => {
    // Some cards are in flight (seen, low mastery); the rest are brand new.
    // None has reached 30% mastery yet, so the algorithm must focus on the
    // in-flight cards and not dilute the session with new cards.
    const notes = [
      ...makeNotes([
        { id: "s1", mastery: 15, timesSeen: 1 },
        { id: "s2", mastery: 0, timesSeen: 2 },
        { id: "s3", mastery: 20, timesSeen: 3 },
      ]),
      ...makeNotes(Array.from({ length: 10 }, (_, i) => ({ id: `new${i}` }))),
    ];
    const picked = selectQuizNotes(notes, 3, makeRng());
    expect(picked).toHaveLength(3);
    for (const p of picked) expect(p.id.startsWith("s")).toBe(true);
  });

  it("admits at least one new card once any card reaches the 30% ready threshold", () => {
    // Heavy seen pool (all not-ready) plus a tiny ready card and many new cards.
    // The "monotonic in progress" rule says: as soon as one card is ready, new
    // cards start trickling in — even if the rounded quota would be 0.
    const notes = [
      ...makeNotes(Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`,
        mastery: i === 0 ? 60 : 10, // exactly one ready card
        timesSeen: 3,
      }))),
      ...makeNotes(Array.from({ length: 5 }, (_, i) => ({ id: `new${i}` }))),
    ];
    // Repeated rolls so we don't claim a property the algorithm only sometimes
    // satisfies — the quota is deterministic, so it must hold every time.
    for (let seed = 1; seed <= 20; seed++) {
      const picked = selectQuizNotes(notes, 4, makeRng(seed));
      const newCount = picked.filter((p) => p.id.startsWith("new")).length;
      expect(newCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("caps new cards at MAX_NEW_SHARE (30%) of the quiz even when every card is mastered", () => {
    // 10 fully-mastered seen cards + 10 new ones. Without a cap the algorithm
    // would lean almost entirely on new cards since seen ones have only the
    // floor weight; the cap keeps reviews dominant.
    const notes = [
      ...makeNotes(Array.from({ length: 10 }, (_, i) => ({
        id: `m${i}`,
        mastery: 100,
        timesSeen: 5,
      }))),
      ...makeNotes(Array.from({ length: 10 }, (_, i) => ({ id: `new${i}` }))),
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const picked = selectQuizNotes(notes, 10, makeRng(seed));
      const newCount = picked.filter((p) => p.id.startsWith("new")).length;
      // 10 * 0.3 * (10/20) = 1.5 → round to 2. Capped at the available new pool.
      expect(newCount).toBeLessThanOrEqual(3);
    }
  });

  it("weights low-mastery cards higher than high-mastery ones over many samples", () => {
    // Equal-size buckets so the only difference is mastery. The selection should
    // surface "weak" cards far more often than "strong" ones.
    const weak = makeNotes(
      Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, mastery: 10, timesSeen: 3 })),
    );
    const strong = makeNotes(
      Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, mastery: 95, timesSeen: 3 })),
    );
    const notes = [...weak, ...strong];

    let weakPicks = 0;
    let strongPicks = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const picked = selectQuizNotes(notes, 5, makeRng(i + 1));
      for (const p of picked) {
        if (p.id.startsWith("w")) weakPicks++;
        else strongPicks++;
      }
    }
    // Ratio is ~ (100-10+5) / (100-95+5) = 95/10 ≈ 9.5x; require ≥3x to keep
    // the test stable against sampling noise.
    expect(weakPicks).toBeGreaterThan(strongPicks * 3);
  });

  it("mastered cards still surface occasionally (selection weight floor)", () => {
    // Floor on the seen weight means a 100%-mastery card can't be permanently
    // shut out. With only mastered cards to choose from, it picks them.
    const notes = makeNotes(
      Array.from({ length: 5 }, (_, i) => ({
        id: `m${i}`,
        mastery: 100,
        timesSeen: 9,
      })),
    );
    const picked = selectQuizNotes(notes, 3, makeRng());
    expect(picked).toHaveLength(3);
  });
});
