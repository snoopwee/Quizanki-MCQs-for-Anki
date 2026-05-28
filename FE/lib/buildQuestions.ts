// Builds multiple-choice questions from a deck's notes. The prompt can bundle
// several fields together (e.g. term + reading + example sentence); the answer
// is always a single field. Distractors are always drawn from the FULL deck's
// answer pool (deduplicated, excluding the correct value) so a tag-filtered quiz
// doesn't collapse to a tiny distractor set.

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

export interface Question {
  noteId: string;
  prompt: PromptSegment[];
  // Flattened prompt text, kept for answer records / the results summary.
  question: string;
  correct: string;
  options: string[];
}

const OPTION_COUNT = 4;

// Mastery threshold for "this card is familiar enough that we should keep the
// learner moving by introducing new cards." Mirrors the product spec — once
// some cards cross 30%, the quiz starts trickling new cards back in.
const READY_THRESHOLD = 30;

// Maximum share of a quiz that can be devoted to brand-new cards. Even when
// every seen card is fully mastered, we don't let new cards eclipse review —
// 30% keeps the rhythm Anki-like (reviews dominate, new cards drip in).
const MAX_NEW_SHARE = 0.3;

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
// order and the option positions within each question, so the answer never sits
// in the same spot twice. Reuses each question's existing options (no rebuild).
export function reshuffleQuestions(
  questions: Question[],
  rng: () => number = Math.random,
): Question[] {
  return shuffle(questions, rng).map((q) => ({
    ...q,
    options: shuffle(q.options, rng),
  }));
}

// Anki-like card selection. The shape of a quiz depends on the deck's learning
// state:
//
// - Cold start (no card ever seen): all picks come from the new pool — there's
//   nothing else to study.
// - Has seen cards but none ready (mastery < 30 everywhere): focus entirely on
//   those, no new cards. The learner has cards in flight; don't dilute.
// - Some cards ready: new cards trickle in proportional to how "familiar" the
//   deck feels (ready_ratio), capped at MAX_NEW_SHARE of the quiz.
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

  // How many *seen* cards to admit, before any cap. The new-card share is
  // gated by how "familiar" the deck feels (ready ratio), but we always favour
  // the seen pool — picks from new fill whatever the seen pool can't provide.
  let preferredNew: number;
  if (seenPool.length === 0) {
    // Cold start — every card is new, so the quiz is all new.
    preferredNew = count;
  } else {
    const ready = seenPool.filter((n) => (n.mastery ?? 0) >= READY_THRESHOLD).length;
    const readyRatio = ready / notes.length;
    preferredNew = Math.round(count * MAX_NEW_SHARE * readyRatio);
    // Once at least one card is "ready," let one new card in even when the
    // ratio rounds to 0, so introduction is monotonic in progress.
    if (ready > 0 && preferredNew === 0) preferredNew = 1;
  }
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

export function buildQuestions(
  notes: QuizNote[],
  count: number,
  config: QuizConfig,
  // Distractors come from this pool when the quiz is a filtered subset; defaults
  // to `notes` so callers without a separate pool still work.
  fullPool: QuizNote[] = notes,
  rng: () => number = Math.random,
): Question[] {
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
      noteId: note.id,
      prompt,
      question,
      correct,
      options: shuffle([correct, ...distractors], rng),
    };
  });
}
