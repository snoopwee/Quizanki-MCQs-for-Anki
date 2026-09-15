import { describe, expect, it } from "vitest";
import {
  askCard,
  buildCardTemplates,
  type CardTemplate,
  type NoteTypeQuizSpec,
  type QuizNote,
} from "@/lib/buildQuestions";
import {
  REQUEUE_GAP,
  answerLearnCard,
  countLearnableCards,
  kindsForCard,
  learnEligibleIds,
  learnProgress,
  learnSpecs,
  stageCounts,
  startLearnSession,
  summarizeLearnSession,
} from "@/lib/learnSession";
import type { ApkgNoteType } from "@/types/api";

function makeRng(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const card = (key: string, order: number, distractors = ["x", "y", "z"]): CardTemplate => ({
  key,
  order,
  base: { noteId: key, prompt: [{ label: "Front", value: `q-${key}` }], question: `q-${key}`, correct: `a-${key}` },
  distractors,
});

const headKey = (s: ReturnType<typeof startLearnSession>) =>
  s.queue.length > 0 ? s.cards[s.queue[0]].template.key : null;

describe("startLearnSession", () => {
  it("keeps deck order when not shuffled and asks the first card", () => {
    const s = startLearnSession([card("c", 2), card("a", 0), card("b", 1)], ["mcq"], { shuffle: false }, makeRng());
    expect(s.queue.map((i) => s.cards[i].template.key)).toEqual(["a", "b", "c"]);
    expect(s.current?.noteId).toBe("a");
    expect(s.current?.kind).toBe("mcq");
    expect(s.asked).toBe(0);
  });

  it("asks every card exactly once in some order when shuffled", () => {
    const s = startLearnSession([card("a", 0), card("b", 1), card("c", 2), card("d", 3)], ["mcq"], { shuffle: true }, makeRng(7));
    expect([...s.queue].sort()).toEqual([0, 1, 2, 3]);
  });

  it("only uses the enabled question types", () => {
    const s = startLearnSession([card("a", 0)], ["truefalse"], { shuffle: false }, makeRng());
    expect(s.current?.kind).toBe("truefalse");
  });

  it("is complete straight away with no cards", () => {
    const s = startLearnSession([], ["mcq"], { shuffle: false });
    expect(s.current).toBeNull();
    expect(learnProgress(s)).toEqual({ learned: 0, done: 0, total: 0 });
  });
});

describe("answerLearnCard", () => {
  const four = () =>
    startLearnSession([card("a", 0), card("b", 1), card("c", 2), card("d", 3)], ["mcq"], { shuffle: false }, makeRng());

  it("learns a card answered correctly and moves to the next", () => {
    const s = answerLearnCard(four(), true, makeRng());
    expect(learnProgress(s)).toEqual({ learned: 1, done: 1, total: 4 });
    expect(headKey(s)).toBe("b");
    expect(s.current?.noteId).toBe("b");
    expect(s.asked).toBe(1);
  });

  it(`sends a missed card back ${REQUEUE_GAP} places`, () => {
    const s = answerLearnCard(four(), false, makeRng());
    expect(s.queue.map((i) => s.cards[i].template.key)).toEqual(["b", "c", "a", "d"]);
    expect(s.cards[0]).toMatchObject({ attempts: 1, misses: 1, learned: false });
    expect(learnProgress(s).learned).toBe(0);
  });

  it("brings a missed card back sooner when fewer cards are left", () => {
    let s = startLearnSession([card("a", 0), card("b", 1)], ["mcq"], { shuffle: false }, makeRng());
    s = answerLearnCard(s, false, makeRng());
    expect(s.queue.map((i) => s.cards[i].template.key)).toEqual(["b", "a"]);
  });

  it("re-asks the last card straight away until it's right", () => {
    let s = startLearnSession([card("a", 0)], ["mcq", "written"], { shuffle: false }, makeRng());
    s = answerLearnCard(s, false, makeRng(3));
    expect(headKey(s)).toBe("a");
    expect(s.current).not.toBeNull();
    s = answerLearnCard(s, true, makeRng());
    expect(s.current).toBeNull();
    expect(s.cards[0]).toMatchObject({ attempts: 2, misses: 1, learned: true });
  });

  it("ends only when every card has been answered correctly", () => {
    let s = four();
    // a✗ → [b,c,a,d]; b✓; c✓; a✓ → [d]; d✗ → [d]; d✓ → done.
    const answers = [false, true, true, true, false, true];
    for (const correct of answers) {
      expect(s.current).not.toBeNull();
      s = answerLearnCard(s, correct, makeRng());
    }
    expect(s.current).toBeNull();
    expect(learnProgress(s)).toEqual({ learned: 4, done: 4, total: 4 });
  });

  it("leaves a complete session unchanged", () => {
    const done = answerLearnCard(startLearnSession([card("a", 0)], ["mcq"], { shuffle: false }), true);
    expect(answerLearnCard(done, false)).toBe(done);
  });
});

describe("answerLearnCard with missed cards not coming back", () => {
  const four = () =>
    startLearnSession(
      [card("a", 0), card("b", 1), card("c", 2), card("d", 3)],
      ["mcq"],
      { shuffle: false, retryMissed: false },
      makeRng(),
    );

  it("moves past a missed card without asking it again", () => {
    const s = answerLearnCard(four(), false, makeRng());
    expect(s.queue.map((i) => s.cards[i].template.key)).toEqual(["b", "c", "d"]);
    expect(s.cards[0]).toMatchObject({ attempts: 1, misses: 1, learned: false });
    expect(learnProgress(s)).toEqual({ learned: 0, done: 1, total: 4 });
  });

  it("ends once every card has been asked, right or wrong", () => {
    let s = four();
    for (const correct of [false, true, false, true]) {
      expect(s.current).not.toBeNull();
      s = answerLearnCard(s, correct, makeRng());
    }
    expect(s.current).toBeNull();
    expect(learnProgress(s)).toEqual({ learned: 2, done: 4, total: 4 });
    const summary = summarizeLearnSession(s);
    expect(summary).toMatchObject({ total: 4, firstTry: 2, answers: 4, retriedMissed: false });
    expect(summary.missed.map((c) => c.template.key)).toEqual(["a", "c"]);
  });
});

describe("summarizeLearnSession", () => {
  it("counts first-try cards and total answers, listing misses most first", () => {
    let s = startLearnSession([card("a", 0), card("b", 1), card("c", 2)], ["mcq"], { shuffle: false }, makeRng());
    // a wrong → [b, c, a]; b wrong → [c, a, b]; c right → [a, b]; a wrong → [b, a];
    // b right → [a]; a right → done.
    for (const correct of [false, false, true, false, true, true]) s = answerLearnCard(s, correct, makeRng());
    const summary = summarizeLearnSession(s);
    expect(summary.total).toBe(3);
    expect(summary.firstTry).toBe(1);
    expect(summary.answers).toBe(6);
    expect(summary.retriedMissed).toBe(true);
    expect(summary.missed.map((c) => [c.template.key, c.misses])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });
});

describe("kindsForCard", () => {
  it("uses the enabled types when the card has distractors", () => {
    expect(kindsForCard(card("a", 0), ["mcq", "truefalse"])).toEqual(["mcq", "truefalse"]);
  });

  it("falls back to written when there's nothing to choose between", () => {
    expect(kindsForCard(card("a", 0, []), ["mcq", "truefalse"])).toEqual(["written"]);
  });
});

describe("askCard", () => {
  it("multiple choice mixes the answer in with the distractors", () => {
    const q = askCard(card("a", 0), "mcq", makeRng());
    expect(q.kind).toBe("mcq");
    if (q.kind === "mcq") expect([...q.options].sort()).toEqual(["a-a", "x", "y", "z"]);
  });

  it("true/false asserts the answer or a distractor, with the matching verdict", () => {
    const truths = new Set<boolean>();
    // One generator across the draws: this LCG's FIRST value is ~0.24 for every small seed,
    // which would land every coin flip on "true".
    const rng = makeRng(42);
    for (let i = 0; i < 20; i++) {
      const q = askCard(card("a", 0), "truefalse", rng);
      if (q.kind !== "truefalse") throw new Error("expected true/false");
      expect(["a-a", "x", "y", "z"]).toContain(q.statement);
      expect(q.truth).toBe(q.statement === "a-a");
      truths.add(q.truth);
    }
    expect(truths).toEqual(new Set([true, false]));
  });

  it("written carries only the shared fields", () => {
    expect(askCard(card("a", 0), "written")).toEqual({ ...card("a", 0).base, kind: "written" });
  });
});

describe("buildCardTemplates", () => {
  const notes: QuizNote[] = ["1", "2", "3", "4", "5", "6"].map((id) => ({
    id: `b${id}`,
    fields: { Front: `term ${id}`, Back: `meaning ${id}` },
  }));
  const specs: NoteTypeQuizSpec[] = [
    { kind: "basic", noteTypeId: "1", questionFields: ["Front"], answerField: "Back", notes },
    {
      kind: "cloze",
      noteTypeId: "2",
      textField: "Text",
      notes: [{ id: "c1", fields: { Text: "{{c1::sun}} and {{c2::moon}}" } }],
    },
  ];

  it("selects the requested number of distinct cards with distractors from the deck", () => {
    const templates = buildCardTemplates(specs, 5, makeRng());
    expect(templates).toHaveLength(5);
    expect(new Set(templates.map((t) => t.key)).size).toBe(5);
    for (const t of templates) {
      expect(t.distractors).toHaveLength(3);
      expect(t.distractors).not.toContain(t.base.correct);
    }
  });

  it("limits what is asked to the eligible notes but keeps the full distractor pool", () => {
    const templates = buildCardTemplates(specs, 5, makeRng(), new Set(["b2"]));
    expect(templates.map((t) => t.base.noteId)).toEqual(["b2"]);
    expect(templates[0].distractors).toHaveLength(3);
  });

  it("gives every card its deck position, cloze deletions included", () => {
    const templates = buildCardTemplates(specs, 99, makeRng());
    expect(templates.map((t) => t.order).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const cloze = templates.filter((t) => t.base.noteId === "c1");
    expect(cloze.map((t) => t.base.correct).sort()).toEqual(["moon", "sun"]);
  });
});

describe("learnSpecs", () => {
  const basic: NoteTypeQuizSpec = { kind: "basic", noteTypeId: "1", questionFields: ["Front", "Reading"], answerField: "Back", notes: [] };
  const cloze: NoteTypeQuizSpec = { kind: "cloze", noteTypeId: "2", textField: "Text", notes: [] };

  it("keeps the deck's direction when answering with the definition", () => {
    const specs = [basic, cloze];
    expect(learnSpecs(specs, "definition")).toBe(specs);
  });

  it("swaps basic types to answer with the term, leaving cloze as it is", () => {
    expect(learnSpecs([basic, cloze], "term")).toEqual([
      { ...basic, questionFields: ["Back"], answerField: "Front" },
      cloze,
    ]);
  });
});

describe("learnEligibleIds / countLearnableCards", () => {
  const note = (id: string, fields: Record<string, string>) => ({ id, ankiNoteId: null, fields, tags: [] });
  const types: ApkgNoteType[] = [
    {
      id: 1,
      name: "Basic",
      cloze: false,
      fieldNames: ["Front", "Back"],
      frontFields: ["Front"],
      backFields: ["Back"],
      noteCount: 3,
      notes: [note("n1", { Front: "a", Back: "A" }), note("n2", { Front: "b", Back: "B" }), note("n3", { Front: "c", Back: "C" })],
    },
    {
      id: 2,
      name: "Cloze",
      cloze: true,
      fieldNames: ["Text"],
      frontFields: [],
      backFields: [],
      noteCount: 1,
      notes: [note("c1", { Text: "{{c1::x}} and {{c2::y}}" })],
    },
  ];
  const stats = new Map([
    ["n1", { mastery: 90, timesSeen: 5, starred: true }],
    ["n2", { mastery: 10, timesSeen: 1, starred: true }],
    ["c1", { mastery: 85, timesSeen: 3 }],
  ]);
  const getStats = (id: string) => stats.get(id);

  it("allows every card when no filter is on", () => {
    expect(learnEligibleIds(types, getStats, { starredOnly: false, includeMastered: true })).toBeUndefined();
    expect(countLearnableCards(types)).toBe(5); // 3 basic + 2 cloze deletions
  });

  it("starred only keeps the starred notes", () => {
    const ids = learnEligibleIds(types, getStats, { starredOnly: true, includeMastered: true });
    expect(ids).toEqual(new Set(["n1", "n2"]));
    expect(countLearnableCards(types, ids)).toBe(2);
  });

  it("leaving out mastered cards drops the seen, 80+ notes", () => {
    const ids = learnEligibleIds(types, getStats, { starredOnly: false, includeMastered: false });
    expect(ids).toEqual(new Set(["n2", "n3"]));
  });

  it("combines both filters", () => {
    expect(learnEligibleIds(types, getStats, { starredOnly: true, includeMastered: false })).toEqual(new Set(["n2"]));
  });
});

describe("stageCounts", () => {
  it("buckets the session's cards by mastery stage", () => {
    const s = startLearnSession([card("a", 0), card("b", 1), card("c", 2), card("d", 3)], ["mcq"], { shuffle: false });
    const lookup = new Map([
      ["a", { mastery: 15, timesSeen: 1 }],
      ["b", { mastery: 45, timesSeen: 3 }],
      ["c", { mastery: 95, timesSeen: 9 }],
    ]);
    expect(stageCounts(s.cards, (id) => lookup.get(id))).toEqual({ new: 1, learning: 1, practicing: 1, mastered: 1 });
  });
});
