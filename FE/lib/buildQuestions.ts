// Builds multiple-choice questions from a deck's notes. The prompt can bundle
// several fields together (e.g. term + reading + example sentence); the answer
// is always a single field. Distractors are always drawn from the FULL deck's
// answer pool (deduplicated, excluding the correct value) so a tag-filtered quiz
// doesn't collapse to a tiny distractor set.
//
// Cloze notes ({@link buildClozeQuestions}) have their own path: each unique
// cloze index in a note becomes a synthetic card whose mastery inherits from
// the parent note. We don't materialize per-cloze stats — the BE still tracks
// mastery at the note level, so all clozes of one note share one number.

import {
  clozeAnswer,
  allClozeAnswers,
  renderClozeFront,
  uniqueClozeIndices,
} from "@/lib/cloze";
import {
  assignQuestionKind,
  buildTrueFalseFace,
  type QuestionKind,
} from "@/lib/questionTypes";

export interface QuizNote {
  id: string;
  fields: Record<string, string>;
  // Optional learning stats — defaults to "never seen" (mastery 0, timesSeen 0).
  // The selection layer uses them to weight which notes appear in a quiz.
  mastery?: number;
  timesSeen?: number;
}

export interface QuizConfig {
  // One or more fields bundled into the prompt, shown in this order.
  questionFields: string[];
  answerField: string;
}

// A single labelled line of the bundled prompt.
export interface PromptSegment {
  label: string;
  value: string;
}

// Every question shares the card identity, prompt, and canonical correct answer;
// the `kind` discriminant carries the format-specific payload. The results screen
// and answer recording only read the shared fields, so adding a format never
// touches mastery / stats / the BE record call.
export interface BaseQuestion {
  noteId: string;
  prompt: PromptSegment[];
  // Flattened prompt text, kept for answer records / the results summary.
  question: string;
  // The canonical correct answer (the answer field). Shown on the results screen.
  correct: string;
}

// Multiple choice — the correct answer among shuffled distractors.
export interface McqQuestion extends BaseQuestion {
  kind: "mcq";
  options: string[];
}

// True / false — assert `statement` (the real answer, or a distractor) and ask
// whether it matches the prompt; `truth` is the right verdict.
export interface TrueFalseQuestion extends BaseQuestion {
  kind: "truefalse";
  statement: string;
  truth: boolean;
}

// Written — the learner types the answer; grading compares the input to the
// `correct` field (see gradeWritten), so no extra payload is needed.
export interface WrittenQuestion extends BaseQuestion {
  kind: "written";
}

export type Question = McqQuestion | TrueFalseQuestion | WrittenQuestion;

const OPTION_COUNT = 4;

// Target share of a quiz devoted to brand-new cards. Flat across all mastery
// states (cold start excepted, see below) so the learner isn't gated by their
// existing cards' progress — at 40%, a 5-question quiz brings 2 new cards
// alongside 3 reviews. Previously this was 30% AND gated by a ready-ratio,
// which meant a learner with a few struggling cards never saw new cards
// until those crossed the practicing threshold. That stalled new-card intake.
const NEW_SHARE = 0.4;

// Floor on a seen card's selection weight. Without this, a 100%-mastery card
// would have weight 0 and never resurface; with it, mastered cards still appear
// occasionally to maintain retention.
const SEEN_WEIGHT_FLOOR = 5;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Efraimidis-Spirakis weighted reservoir: assign each item key = -ln(U)/w,
// sort ascending, take the top k. Deterministic given a deterministic rng.
function weightedSampleWithoutReplacement<T>(
  pool: T[],
  k: number,
  weight: (item: T) => number,
  rng: () => number,
): T[] {
  if (k <= 0) return [];
  if (k >= pool.length) return shuffle(pool, rng);
  const keyed = pool.map((item) => {
    const w = Math.max(weight(item), 1e-9);
    const u = Math.max(rng(), 1e-12);
    return { item, key: -Math.log(u) / w };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, k).map(({ item }) => item);
}

// Re-randomizes an existing set of questions for a retake: shuffles the question
// order and, for multiple-choice, the option positions within each question so
// the answer never sits in the same spot twice. True/False and Written have no
// positional layout to re-randomize, so they pass through unchanged.
export function reshuffleQuestions(
  questions: Question[],
  rng: () => number = Math.random,
): Question[] {
  return shuffle(questions, rng).map((q) =>
    q.kind === "mcq" ? { ...q, options: shuffle(q.options, rng) } : q,
  );
}

// Card selection. The shape of a quiz depends on which pools exist:
//
// - Cold start (no card ever seen): all picks come from the new pool — there's
//   nothing else to study.
// - Mixed: a flat NEW_SHARE of the quiz goes to brand-new cards, regardless of
//   how the existing cards are doing. This keeps new content flowing instead of
//   stalling on a small pool of struggling cards. The remainder is review.
//
// Among seen cards, selection is weighted by (100 - mastery + floor) so a freshly-
// missed card is dramatically more likely than a mastered one, but mastered cards
// still surface occasionally for retention.
export function selectQuizNotes<T extends QuizNote>(
  notes: T[],
  count: number,
  rng: () => number = Math.random,
): T[] {
  if (count <= 0 || notes.length === 0) return [];
  if (notes.length <= count) return shuffle(notes, rng);

  const newPool: T[] = [];
  const seenPool: T[] = [];
  for (const n of notes) {
    if ((n.timesSeen ?? 0) === 0) newPool.push(n);
    else seenPool.push(n);
  }

  // Cold start = no choice; otherwise admit the flat new share. The quotas
  // below then spill in either direction when a pool can't fill its slice.
  let preferredNew = seenPool.length === 0 ? count : Math.round(count * NEW_SHARE);
  preferredNew = Math.min(preferredNew, newPool.length);

  // Cap the seen take by what the seen pool actually has — without this, a
  // partially-played deck where only 1–2 cards have been answered and none has
  // hit the ready threshold yields a 1-question quiz instead of filling the
  // remaining slots from the new pool.
  const seenQuota = Math.min(count - preferredNew, seenPool.length);
  const newQuota = Math.min(count - seenQuota, newPool.length);

  const fromNew = weightedSampleWithoutReplacement(newPool, newQuota, () => 1, rng);
  const fromSeen = weightedSampleWithoutReplacement(
    seenPool,
    seenQuota,
    (n) => Math.max(SEEN_WEIGHT_FLOOR, 100 - (n.mastery ?? 0) + SEEN_WEIGHT_FLOOR),
    rng,
  );

  return shuffle([...fromNew, ...fromSeen], rng);
}

/**
 * Counts every unique cloze deletion across the given notes' {@code textField}.
 * Useful for the setup UI's "available questions" bound — cloze notes can yield
 * many more cards than the raw note count.
 */
export function countClozeCards(notes: QuizNote[], textField: string): number {
  let total = 0;
  for (const n of notes) {
    total += uniqueClozeIndices(n.fields[textField] ?? "").length;
  }
  return total;
}

/**
 * Detects the field that holds cloze syntax inside a note type. Anki's built-in
 * Cloze type calls it "Text" but community types vary; we look at the actual
 * note content rather than the name. Returns the first field where any note
 * contains a {@code {{c<n>::...}}} marker, or {@code null} when none does.
 */
export function detectClozeField(
  fieldNames: string[],
  notes: Array<{ fields: Record<string, string> }>,
): string | null {
  for (const f of fieldNames) {
    for (const n of notes) {
      if (uniqueClozeIndices(n.fields[f] ?? "").length > 0) {
        return f;
      }
    }
  }
  return null;
}

/**
 * Builds MCQ questions from cloze notes. Each unique cloze index in a note
 * produces one quiz card; mastery weighting and selection share the parent
 * note's stats (the BE tracks mastery at the note level, not per-cloze).
 *
 * Distractors are pulled from every cloze answer in {@code fullPool}, so even
 * a 4-note deck has a decent answer pool as long as it has enough clozes.
 */
export function buildClozeQuestions(
  notes: QuizNote[],
  count: number,
  textField: string,
  fullPool: QuizNote[] = notes,
  rng: () => number = Math.random,
): McqQuestion[] {
  // One synthetic QuizNote per cloze deletion. The selection layer treats them
  // exactly like normal notes, so mastery weighting "just works" — every
  // synthetic clone of a note shares the same mastery/timesSeen.
  type Synth = QuizNote & {
    clozeIndex: number;
    clozeText: string;
    parentId: string;
  };
  const synthetic: Synth[] = [];
  for (const n of notes) {
    const text = n.fields[textField] ?? "";
    for (const idx of uniqueClozeIndices(text)) {
      synthetic.push({
        id: `${n.id}-c${idx}`,
        fields: n.fields,
        mastery: n.mastery,
        timesSeen: n.timesSeen,
        clozeIndex: idx,
        clozeText: text,
        parentId: n.id,
      });
    }
  }

  const answerPool = Array.from(
    new Set(
      fullPool.flatMap((n) => allClozeAnswers(n.fields[textField] ?? "")).filter(
        (a) => a.length > 0,
      ),
    ),
  );

  const selected = selectQuizNotes(synthetic, Math.max(0, count), rng);

  return selected.map((s) => {
    const correct = clozeAnswer(s.clozeText, s.clozeIndex);
    const question = renderClozeFront(s.clozeText, s.clozeIndex);
    const distractors = shuffle(
      answerPool.filter((a) => a !== correct),
      rng,
    ).slice(0, OPTION_COUNT - 1);

    return {
      kind: "mcq",
      // Parent note id, not the synthetic one — answer recording + mastery
      // updates need to land on the real note row.
      noteId: s.parentId,
      prompt: [{ label: "Cloze", value: question }],
      question,
      correct,
      options: shuffle([correct, ...distractors], rng),
    };
  });
}

/**
 * A per-note-type spec that {@link buildMixedQuestions} consumes. The caller
 * resolves field choices upfront (template defaults, detection heuristic, or
 * the user's persisted preferences); the builder just dispatches to the right
 * question shape per note. Both shapes carry the {@code notes} list directly
 * so the builder doesn't need to keep noteTypes and pools in sync.
 */
export type NoteTypeQuizSpec =
  | {
      kind: "basic";
      noteTypeId: string;
      questionFields: string[];
      answerField: string;
      notes: QuizNote[];
    }
  | {
      kind: "cloze";
      noteTypeId: string;
      textField: string;
      notes: QuizNote[];
    };

/**
 * Builds questions across multiple note types in a single quiz. Each spec
 * contributes to a unified selection pool — basic notes as-is, cloze notes
 * pre-expanded into synthetic per-cloze entries inheriting parent mastery.
 * {@link selectQuizNotes} runs across the union, then each pick is rendered
 * with its own type's builder. Distractors stay within the originating note
 * type so a cloze answer never leaks into a basic question and vice versa.
 *
 * {@code eligibleNoteIds}, when given, restricts which notes can be *asked*
 * (e.g. a starred-only quiz) — but distractor pools are still built from every
 * note, so a small starred subset doesn't collapse to a 2-option MCQ. This
 * keeps the long-standing "distractors from the full pool" rule.
 */
export function buildMixedQuestions(
  specs: NoteTypeQuizSpec[],
  count: number,
  rng: () => number = Math.random,
  eligibleNoteIds?: Set<string>,
  // Which question formats the quiz may use. Each selected card is randomly
  // assigned one enabled kind. Defaults to multiple-choice only so existing
  // callers/tests are unaffected.
  enabledKinds: QuestionKind[] = ["mcq"],
): Question[] {
  type Synth = QuizNote & {
    parentId: string;
    noteTypeId: string;
    kind: "basic" | "cloze";
    // basic
    basicQuestionFields?: string[];
    basicAnswerField?: string;
    // cloze
    clozeText?: string;
    clozeIndex?: number;
  };

  const pool: Synth[] = [];
  // Same-type distractor pool per spec, keyed by noteTypeId. Two basic note
  // types each draw from their own answer pool first — distractors stay
  // semantically near the question.
  const answerPoolByType = new Map<string, string[]>();
  // Cross-type fallback pool. When a note type can't fill 3 distractors out of
  // its own answers (sparse deck, e.g. 3 basic + 3 cloze), we top up from any
  // other answer in the deck so MCQs still land on 4 options. Distractor
  // quality drops in that case, but it beats a 2-option quiz.
  const globalAnswerPool = new Set<string>();

  for (const spec of specs) {
    if (spec.kind === "basic") {
      const answers = Array.from(
        new Set(
          spec.notes
            .map((n) => n.fields[spec.answerField] ?? "")
            .filter((v) => v.length > 0),
        ),
      );
      answerPoolByType.set(spec.noteTypeId, answers);
      for (const a of answers) globalAnswerPool.add(a);
      for (const n of spec.notes) {
        pool.push({
          id: n.id,
          fields: n.fields,
          mastery: n.mastery,
          timesSeen: n.timesSeen,
          parentId: n.id,
          noteTypeId: spec.noteTypeId,
          kind: "basic",
          basicQuestionFields: spec.questionFields,
          basicAnswerField: spec.answerField,
        });
      }
    } else {
      const answers = Array.from(
        new Set(
          spec.notes
            .flatMap((n) => allClozeAnswers(n.fields[spec.textField] ?? ""))
            .filter((v) => v.length > 0),
        ),
      );
      answerPoolByType.set(spec.noteTypeId, answers);
      for (const a of answers) globalAnswerPool.add(a);
      for (const n of spec.notes) {
        const text = n.fields[spec.textField] ?? "";
        for (const idx of uniqueClozeIndices(text)) {
          pool.push({
            // Synthetic id has to be globally unique — note ids can repeat across
            // a cloze note's clozes, so we tag with the index AND noteTypeId.
            id: `${n.id}-c${idx}-${spec.noteTypeId}`,
            fields: n.fields,
            mastery: n.mastery,
            timesSeen: n.timesSeen,
            parentId: n.id,
            noteTypeId: spec.noteTypeId,
            kind: "cloze",
            clozeText: text,
            clozeIndex: idx,
          });
        }
      }
    }
  }

  // Restrict the *askable* pool to the eligible subset (if given), keeping the
  // answer pools above intact so distractors still come from the whole deck.
  const askable = eligibleNoteIds
    ? pool.filter((s) => eligibleNoteIds.has(s.parentId))
    : pool;
  const selected = selectQuizNotes(askable, Math.max(0, count), rng);
  const globalPool = Array.from(globalAnswerPool);

  return selected.map((s) => {
    const sameTypePool = answerPoolByType.get(s.noteTypeId) ?? [];
    let base: BaseQuestion;
    if (s.kind === "cloze") {
      const correct = clozeAnswer(s.clozeText!, s.clozeIndex!);
      const question = renderClozeFront(s.clozeText!, s.clozeIndex!);
      base = { noteId: s.parentId, prompt: [{ label: "Cloze", value: question }], question, correct };
    } else {
      const correct = s.fields[s.basicAnswerField!] ?? "";
      const prompt = s.basicQuestionFields!
        .map((f) => ({ label: f, value: s.fields[f] ?? "" }))
        .filter((seg) => seg.value.length > 0);
      const question = prompt.map((seg) => seg.value).join(" — ");
      base = { noteId: s.parentId, prompt, question, correct };
    }
    return shapeQuestion(base, assignQuestionKind(enabledKinds, rng), sameTypePool, globalPool, rng);
  });
}

/**
 * Wraps a card's shared fields into a concrete question of the chosen format.
 * MCQ pulls distractors (same-type first, padded from the global pool); True/
 * False asserts the answer or a distractor 50/50 (preferring a same-type false
 * statement); Written precomputes the accepted-answer set for grading.
 */
function shapeQuestion(
  base: BaseQuestion,
  kind: QuestionKind,
  sameTypePool: string[],
  globalPool: string[],
  rng: () => number,
): Question {
  if (kind === "written") {
    return { ...base, kind: "written" };
  }
  if (kind === "truefalse") {
    // A same-type false statement is more plausible; fall back to the global
    // pool only when this type has no other answer to assert.
    const pool = sameTypePool.some((a) => a !== base.correct) ? sameTypePool : globalPool;
    const { statement, truth } = buildTrueFalseFace(base.correct, pool, rng);
    return { ...base, kind: "truefalse", statement, truth };
  }
  const distractors = pickDistractors(base.correct, sameTypePool, globalPool, rng);
  return { ...base, kind: "mcq", options: shuffle([base.correct, ...distractors], rng) };
}

/**
 * Selects up to {@code OPTION_COUNT - 1} distractors for a question. Prefers
 * the same-type pool (semantically closer to the correct answer); when that
 * can't supply enough unique values, pads from the global pool. Both pools
 * are deduped by string equality, and the correct answer is always excluded.
 */
function pickDistractors(
  correct: string,
  sameTypePool: string[],
  globalPool: string[],
  rng: () => number,
): string[] {
  const need = OPTION_COUNT - 1;
  const sameType = shuffle(
    sameTypePool.filter((a) => a !== correct),
    rng,
  );
  if (sameType.length >= need) return sameType.slice(0, need);
  const used = new Set([correct, ...sameType]);
  const padding = shuffle(
    globalPool.filter((a) => !used.has(a)),
    rng,
  );
  return [...sameType, ...padding].slice(0, need);
}

export function buildQuestions(
  notes: QuizNote[],
  count: number,
  config: QuizConfig,
  // Distractors come from this pool when the quiz is a filtered subset; defaults
  // to `notes` so callers without a separate pool still work.
  fullPool: QuizNote[] = notes,
  rng: () => number = Math.random,
): McqQuestion[] {
  const { questionFields, answerField } = config;

  const allAnswers = Array.from(
    new Set(fullPool.map((n) => n.fields[answerField] ?? "").filter((v) => v.length > 0)),
  );

  const selected = selectQuizNotes(notes, Math.max(0, count), rng);

  return selected.map((note) => {
    const correct = note.fields[answerField] ?? "";

    // Bundle the chosen prompt fields, dropping any that are empty for this note.
    const prompt = questionFields
      .map((field) => ({ label: field, value: note.fields[field] ?? "" }))
      .filter((seg) => seg.value.length > 0);
    const question = prompt.map((seg) => seg.value).join(" — ");

    const distractors = shuffle(
      allAnswers.filter((a) => a !== correct),
      rng,
    ).slice(0, OPTION_COUNT - 1);

    return {
      kind: "mcq",
      noteId: note.id,
      prompt,
      question,
      correct,
      options: shuffle([correct, ...distractors], rng),
    };
  });
}
