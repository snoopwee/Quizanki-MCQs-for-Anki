// Builds multiple-choice questions from a deck's notes. The prompt can bundle
// several fields together (e.g. term + reading + example sentence); the answer
// is always a single field. Distractors are always drawn from the FULL deck's
// answer pool (deduplicated, excluding the correct value) so a tag-filtered quiz
// doesn't collapse to a tiny distractor set.

export interface QuizNote {
  id: string;
  fields: Record<string, string>;
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

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

  const selected = shuffle(notes, rng).slice(0, Math.max(0, count));

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
