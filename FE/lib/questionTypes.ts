// Pure logic for the quiz's question formats (Multiple choice / True-False /
// Written). Kept separate from `buildQuestions.ts` so the grading + generation
// rules are unit-testable in isolation and reused at both build time (assigning
// a kind, generating a True/False statement) and answer time (grading a typed
// answer). No React, no I/O — deterministic given an injected rng.

import { stripLatex } from "@/lib/displayText";
import { stripFurigana } from "@/lib/furigana";

export type QuestionKind = "mcq" | "truefalse" | "written";

// Order the setup screen shows them in, and the canonical iteration order.
export const ALL_QUESTION_KINDS: QuestionKind[] = ["mcq", "truefalse", "written"];

// Switches one format on or off in an enabled set, keeping canonical order. The set never
// empties: switching off the last one returns it unchanged.
export function toggleQuestionKind(enabled: QuestionKind[], kind: QuestionKind): QuestionKind[] {
  const has = enabled.includes(kind);
  if (has && enabled.length === 1) return enabled;
  const next = has ? enabled.filter((k) => k !== kind) : [...enabled, kind];
  return ALL_QUESTION_KINDS.filter((k) => next.includes(k));
}

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
  return stripFurigana(stripLatex(s))
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
//
// `typoTolerant` (Learn's "smart grading"; the quiz never passes it) also credits a near
// miss of an accepted answer — see typoAllowance.
export function gradeWritten(
  input: string,
  correct: string,
  options: { typoTolerant?: boolean } = {},
): boolean {
  const norm = normalizeWritten(input);
  if (norm.length === 0) return false;
  const accepted = acceptedAnswers(correct);
  if (accepted.includes(norm)) return true;
  if (!options.typoTolerant) return false;
  return accepted.some((answer) => {
    const allowance = typoAllowance(answer);
    return allowance > 0 && editDistanceWithin(norm, answer, allowance);
  });
}

// How many single-character slips smart grading forgives for an accepted answer. None up
// to 4 characters — one wrong letter there is usually a different word ("cat" / "cot"),
// and most CJK words are that short. One up to 8 characters, two beyond.
export function typoAllowance(answer: string): number {
  const length = Array.from(answer).length;
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

// Whether `a` becomes `b` in at most `max` edits — an insertion, deletion, substitution,
// or swap of two neighbouring characters each count as one (optimal string alignment).
// Compares code points, so a kana or an emoji is one character.
export function editDistanceWithin(a: string, b: string, max: number): boolean {
  const s = Array.from(a);
  const t = Array.from(b);
  if (Math.abs(s.length - t.length) > max) return false;
  let beforePrev: number[] = [];
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        best = Math.min(best, beforePrev[j - 2] + 1);
      }
      row.push(best);
    }
    beforePrev = prev;
    prev = row;
  }
  return prev[t.length] <= max;
}
