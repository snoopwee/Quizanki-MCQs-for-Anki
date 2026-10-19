// What a keypress means during a quiz. Pure so the mapping can be tested without a browser —
// the component only has to decide whether the keyboard is ours to listen to at all.

export type QuizKeyAction =
  | { type: "option"; index: number }
  | { type: "truefalse"; value: boolean }
  | { type: "advance" };

export interface QuizKeyContext {
  /** Which renderer is on screen. Written questions never take shortcuts — see below. */
  kind: "mcq" | "truefalse" | "written";
  /** How many options this question offers, so "5" does nothing on a four-option card. */
  optionCount: number;
  /** True once the answer is locked in: the keyboard switches from answering to advancing. */
  answered: boolean;
}

/** `A` → 0, `B` → 1 … Case-insensitive. -1 for anything that isn't a letter. */
function letterIndex(key: string): number {
  if (key.length !== 1) return -1;
  const i = key.toUpperCase().charCodeAt(0) - 65;
  return i >= 0 && i < 26 ? i : -1;
}

/** `1` → 0, `2` → 1 … `9` → 8. -1 for anything else, including `0`. */
function digitIndex(key: string): number {
  if (!/^[1-9]$/.test(key)) return -1;
  return Number(key) - 1;
}

/**
 * The action a key should trigger, or `null` for "not ours — leave it alone".
 *
 * <p>Answering by keyboard is the difference between a study tool and a form: a learner doing
 * fifty questions should never have to move a hand to the mouse. The deck page's flashcard player
 * already advertises its shortcuts; the quiz had none at all.
 *
 * <p><b>Written questions deliberately get nothing.</b> The learner is typing their answer, so
 * every letter and digit belongs to the input. The caller additionally ignores keys whenever a
 * text field has focus, which is the real guard; this is the second one.
 */
export function quizKeyAction(key: string, ctx: QuizKeyContext): QuizKeyAction | null {
  if (ctx.kind === "written") return null;

  if (ctx.answered) {
    // The answer is locked; the only thing left to do is move on.
    return key === "Enter" || key === "ArrowRight" ? { type: "advance" } : null;
  }

  if (ctx.kind === "truefalse") {
    if (key === "t" || key === "T" || key === "1") return { type: "truefalse", value: true };
    if (key === "f" || key === "F" || key === "2") return { type: "truefalse", value: false };
    return null;
  }

  // MCQ: both the visible A/B/C/D labels and the digits above them, because people reach for
  // whichever they saw. An index past the end of this question's options is not an answer.
  const index = letterIndex(key) >= 0 ? letterIndex(key) : digitIndex(key);
  if (index < 0 || index >= ctx.optionCount) return null;
  return { type: "option", index };
}

/** The hint shown under the question, matching what the keys actually do. */
export function quizKeyHint(ctx: Pick<QuizKeyContext, "kind" | "answered">): string | null {
  if (ctx.kind === "written") return null;
  if (ctx.answered) return "Enter to continue";
  return ctx.kind === "truefalse" ? "T / F to answer" : "A–D or 1–4 to answer";
}
