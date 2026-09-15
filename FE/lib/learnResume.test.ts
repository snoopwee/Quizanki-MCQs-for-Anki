import { describe, expect, it } from "vitest";
import type { CardTemplate } from "@/lib/buildQuestions";
import { DEFAULT_LEARN_PREFS } from "@/lib/learnPreferences";
import { LEARN_RESUME_MAX_AGE_MS, restoreLearnSnapshot, type LearnSnapshot } from "@/lib/learnResume";
import { answerLearnCard, learnProgress, startLearnSession, type LearnSession } from "@/lib/learnSession";

function makeRng(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const card = (key: string, order: number): CardTemplate => ({
  key,
  order,
  base: { noteId: key, prompt: [{ label: "Front", value: `q-${key}` }], question: `q-${key}`, correct: `a-${key}` },
  distractors: ["x", "y", "z"],
});

const NOW = 1_800_000_000_000;
const NOTE_IDS = new Set(["a", "b", "c"]);

// Three cards, the first one missed: the queue is [b, c, a] with "b" on screen.
function midSession(): LearnSession {
  const session = startLearnSession([card("a", 0), card("b", 1), card("c", 2)], ["mcq"], { shuffle: false }, makeRng());
  return answerLearnCard(session, false, makeRng());
}

// Round-tripped through JSON, exactly as localStorage hands it back.
function stored(overrides: Partial<LearnSnapshot> = {}): Record<string, unknown> {
  const snapshot: LearnSnapshot = {
    savedAt: NOW - 60_000,
    sessionId: "session-1",
    prefs: { ...DEFAULT_LEARN_PREFS, count: 12 },
    session: midSession(),
    pending: null,
    ...overrides,
  };
  return JSON.parse(JSON.stringify(snapshot));
}

function withSession(patch: Record<string, unknown>): Record<string, unknown> {
  const value = stored();
  return { ...value, session: { ...(value.session as Record<string, unknown>), ...patch } };
}

const keys = (s: LearnSession) => s.queue.map((i) => s.cards[i].template.key);

describe("restoreLearnSnapshot", () => {
  it("restores the session exactly as it was saved, question on screen included", () => {
    const restored = restoreLearnSnapshot(stored(), NOTE_IDS, NOW);
    expect(restored?.sessionId).toBe("session-1");
    expect(restored?.prefs.count).toBe(12);
    expect(restored?.session).toEqual(midSession());
  });

  it("applies a pick recorded before Next, so that answer isn't asked again", () => {
    const restored = restoreLearnSnapshot(stored({ pending: true }), NOTE_IDS, NOW, makeRng());
    expect(keys(restored!.session)).toEqual(["c", "a"]);
    expect(restored!.session.asked).toBe(2);
    expect(restored!.session.current?.noteId).toBe("c");
  });

  it("returns a finished session when the pending pick answered the last card", () => {
    const lastCard = startLearnSession([card("a", 0)], ["mcq"], { shuffle: false }, makeRng());
    const restored = restoreLearnSnapshot(stored({ session: lastCard, pending: true }), NOTE_IDS, NOW, makeRng());
    expect(restored!.session.current).toBeNull();
    expect(learnProgress(restored!.session)).toEqual({ learned: 1, done: 1, total: 1 });
  });

  it("keeps the missed-cards setting, and treats a save from before it as on", () => {
    const off = startLearnSession([card("a", 0)], ["mcq"], { shuffle: false, retryMissed: false }, makeRng());
    expect(restoreLearnSnapshot(stored({ session: off }), NOTE_IDS, NOW)?.session.retryMissed).toBe(false);
    const legacy = withSession({ retryMissed: undefined });
    expect(restoreLearnSnapshot(legacy, NOTE_IDS, NOW)?.session.retryMissed).toBe(true);
  });

  it("starts fresh when the save is older than a week", () => {
    expect(restoreLearnSnapshot(stored({ savedAt: NOW - LEARN_RESUME_MAX_AGE_MS - 1 }), NOTE_IDS, NOW)).toBeNull();
    expect(restoreLearnSnapshot(stored({ savedAt: NOW - LEARN_RESUME_MAX_AGE_MS }), NOTE_IDS, NOW)).not.toBeNull();
  });

  it("starts fresh when a card in the session has left the deck", () => {
    expect(restoreLearnSnapshot(stored(), new Set(["a", "b"]), NOW)).toBeNull();
  });

  it("asks the card on screen afresh when its saved question doesn't fit", () => {
    const value = withSession({ current: { kind: "mcq", noteId: "b", options: ["x", "y"] } });
    const restored = restoreLearnSnapshot(value, NOTE_IDS, NOW, makeRng());
    expect(restored?.session.current?.noteId).toBe("b");
    if (restored?.session.current?.kind === "mcq") expect(restored.session.current.options).toContain("a-b");
  });

  it("rejects saves that aren't a resumable session", () => {
    const bad: unknown[] = [
      null,
      "session",
      stored({ sessionId: "" }),
      withSession({ queue: [] }),
      withSession({ queue: [0, 0] }),
      withSession({ queue: [5] }),
      withSession({ cards: [] }),
      withSession({ kinds: ["flashcards"] }),
      withSession({ asked: -1 }),
      withSession({ cards: [{ template: { key: "a" }, attempts: 0, misses: 0, learned: false }] }),
    ];
    for (const value of bad) expect(restoreLearnSnapshot(value, NOTE_IDS, NOW)).toBeNull();
  });
});
