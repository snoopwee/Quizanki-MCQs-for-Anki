// Pure logic for the quiz's question formats (Multiple choice / True-False /
// Written). Kept separate from `buildQuestions.ts` so the grading + generation
// rules are unit-testable in isolation and reused at both build time (assigning
// a kind, generating a True/False statement) and answer time (grading a typed
// answer). No React, no I/O — deterministic given an injected rng.

import { stripLatex } from "@/lib/displayText";

export type QuestionKind = "mcq" | "truefalse" | "written";

// Order the setup screen shows them in, and the canonical iteration order.
export const ALL_QUESTION_KINDS: QuestionKind[] = ["mcq", "truefalse", "written"];

// Uniformly pick one enabled kind for a single card. The setup screen guarantees
// at least one kind is enabled; the empty-set fallback to "mcq" is just defensive
// so a bad caller can never produce a question with no renderable format.
export function assignQuestionKind(
  enabled: QuestionKind[],
  rng: () => number = Math.random,
): QuestionKind {
  if (enabled.length === 0) return "mcq";
  return enabled[Math.floor(rng() * enabled.length)] ?? enabled[0];
}

// Builds a True/False prompt: 50/50 assert either the real answer (truth = true)
// or one of the card's distractors (truth = false). Falls back to a true
// statement when there's no usable distractor, so a tiny deck can't yield a
// False question with nothing false to show. The rng is consumed at most twice
// (the coin flip, then the distractor pick) — deterministic for tests.
export function buildTrueFalseFace(
  correct: string,
  distractors: string[],
  rng: () => number = Math.random,
): { statement: string; truth: boolean } {
  const pool = distractors.filter((d) => d.length > 0 && d !== correct);
  if (pool.length === 0 || rng() < 0.5) {
    return { statement: correct, truth: true };
  }
  const pick = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  return { statement: pick, truth: false };
}

// Normalizes a written answer for lenient comparison: drop LaTeX markup, lower-
// case, unicode-normalize, replace quotes/brackets/terminal punctuation with
// spaces, and collapse runs of whitespace. This runs on BOTH the typed input and
// each acceptable answer so "To eat." and "  to  eat " compare equal. It never
// touches the values shown on screen — only the comparison keys.
export function normalizeWritten(s: string): string {
  return stripLatex(s)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[「」『』【】《》"'“”‘’()（）\[\]{}.,!?…。、，！？；;:：/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The set of acceptable normalized answers parsed from a card's correct field.
// Anki decks routinely list alternatives with "/", ";", "；", "、" or newlines
// (e.g. "big / large", "行く；いく") — each alternative is accepted on its own,
// and the whole field is accepted too (so a genuine "a/b" answer still matches
// when typed verbatim). Comma is deliberately NOT a separator — it appears
// inside real sentence answers.
export function acceptedAnswers(correct: string): string[] {
  const parts = correct
    .split(/[/;；、\n]+/)
    .map((p) => normalizeWritten(p))
    .filter((p) => p.length > 0);
  const whole = normalizeWritten(correct);
  const set = new Set(parts);
  if (whole.length > 0) set.add(whole);
  return [...set];
}

// Grades a typed answer against a card's correct field. Case/whitespace/markup-
// insensitive exact match against any accepted alternative. Blank input is always
// wrong. Imperfect by design — the session offers an "I was right" override for
// answers this can't credit (synonyms, extra words, typos).
export function gradeWritten(input: string, correct: string): boolean {
  const norm = normalizeWritten(input);
  if (norm.length === 0) return false;
  return acceptedAnswers(correct).includes(norm);
}
