// Anki cloze deletions: {{c<n>::answer}} or {{c<n>::answer::hint}}.
// A single note's cloze field can host multiple deletions; each unique <n>
// produces one quiz card (Anki convention). Two markers with the same <n>
// reveal together — we surface their combined text as the canonical answer.
//
// We parse the cleaned field text (HTML / [sound:] already stripped by the BE
// parser), so the regex doesn't need to worry about Anki's HTML soup. Nested
// braces inside answers (rare) aren't supported — Anki's UI doesn't really
// produce them in cleaned form, and supporting them would force a balanced
// parser for negligible gain.

const CLOZE = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

export interface ClozeMatch {
  /** The {@code c<n>} index, e.g. 1 for {@code {{c1::...}}}. */
  index: number;
  /** The text inside the cloze (what the learner has to recall). */
  answer: string;
  /** Optional hint after a second {@code ::}, shown when the cloze is hidden. */
  hint?: string;
  start: number;
  end: number;
}

export function extractClozes(text: string): ClozeMatch[] {
  const out: ClozeMatch[] = [];
  CLOZE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CLOZE.exec(text)) !== null) {
    out.push({
      index: Number(m[1]),
      answer: m[2],
      hint: m[3] || undefined,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/** Unique cloze indices in first-seen order — one quiz card per entry. */
export function uniqueClozeIndices(text: string): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const c of extractClozes(text)) {
    if (!seen.has(c.index)) {
      seen.add(c.index);
      order.push(c.index);
    }
  }
  return order;
}

/**
 * Renders the prompt side of a cloze card: the active cloze (and any others
 * sharing its index) is hidden behind {@code [hint]} or {@code [...]}; every
 * other cloze is revealed to its answer text. This is the text the learner
 * sees as the MCQ question.
 */
export function renderClozeFront(text: string, activeIndex: number): string {
  return text.replace(CLOZE, (_full, idxStr: string, answer: string, hint?: string) => {
    const idx = Number(idxStr);
    if (idx === activeIndex) {
      return `[${hint && hint.length > 0 ? hint : "..."}]`;
    }
    return answer;
  });
}

/**
 * Renders the answer side of a cloze card: every cloze is revealed to its
 * answer text. Used by the flashcard viewer's back face so the learner sees
 * the full sentence with the missing word filled in.
 */
export function renderClozeBack(text: string): string {
  return text.replace(CLOZE, (_full, _idxStr: string, answer: string) => answer);
}

/**
 * The canonical answer string for a given cloze index. When the index appears
 * more than once in the same field (e.g. two {@code {{c1::...}}} markers, a
 * common pattern for "match these two terms"), the answers are joined with a
 * middle dot so the result is still a unique, useful MCQ correct value.
 */
export function clozeAnswer(text: string, index: number): string {
  return extractClozes(text)
    .filter((c) => c.index === index)
    .map((c) => c.answer)
    .join(" · ");
}

/** Every distinct cloze answer in the text — used to build the distractor pool. */
export function allClozeAnswers(text: string): string[] {
  return extractClozes(text).map((c) => c.answer);
}
