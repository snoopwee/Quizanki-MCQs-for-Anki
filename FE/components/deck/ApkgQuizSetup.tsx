"use client";

import { useMemo, useState } from "react";
import { detectFields, selectableFields } from "@/lib/detectFields";
import { buildQuestions, type Question, type QuizNote } from "@/lib/buildQuestions";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FieldSelect } from "@/components/deck/FieldSelect";
import type { ApkgNoteType, ApkgParseResponse } from "@/types/api";

// A note type can power a multiple-choice quiz only if it has at least two
// fields (a prompt and an answer) and at least one note.
function isQuizable(t: ApkgNoteType): boolean {
  return t.fieldNames.length >= 2 && t.noteCount > 0;
}

const COUNT_CHOICES = [10, 20, 50, 100];

export function ApkgQuizSetup({
  parsed,
  onStart,
  onBack,
}: {
  parsed: ApkgParseResponse;
  onStart: (questions: Question[]) => void;
  onBack: () => void;
}) {
  const quizable = useMemo(() => parsed.noteTypes.filter(isQuizable), [parsed]);
  const [noteTypeId, setNoteTypeId] = useState<number | null>(quizable[0]?.id ?? null);
  const selected = quizable.find((t) => t.id === noteTypeId) ?? null;

  if (quizable.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">Set up a quiz</h1>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          None of the note types in <span className="font-medium">{parsed.filename}</span> have
          enough text fields to build a quiz. Cloze and single-field (e.g. image-only) note types
          aren&apos;t supported yet.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Set up a quiz</h1>

      {quizable.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="note-type" className="text-sm font-medium">
            Note type
          </label>
          <select
            id="note-type"
            value={noteTypeId ?? ""}
            onChange={(e) => setNoteTypeId(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
          >
            {quizable.map((t) => (
              <option
                key={t.id}
                value={t.id}
                className="bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {t.name} ({t.noteCount} notes)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Remount per note type so detection-derived field defaults reset cleanly. */}
      {selected && (
        <NoteTypeQuiz key={selected.id} noteType={selected} onStart={onStart} onBack={onBack} />
      )}
    </div>
  );
}

function sampleValue(notes: ApkgNoteType["notes"], field: string): string {
  const found = notes.find((n) => (n.fields[field] ?? "").length > 0);
  return found ? found.fields[field] : "(empty)";
}

function NoteTypeQuiz({
  noteType,
  onStart,
  onBack,
}: {
  noteType: ApkgNoteType;
  onStart: (questions: Question[]) => void;
  onBack: () => void;
}) {
  const detection = useMemo(
    () => detectFields(noteType.notes, noteType.fieldNames),
    [noteType],
  );

  // Offer only fields that make sense as quiz content; always keep the detected
  // question/answer fields, and fall back to all fields if filtering is too harsh.
  const fieldChoices = useMemo(() => {
    const allowed = selectableFields(noteType.notes, noteType.fieldNames);
    const choices = noteType.fieldNames.filter(
      (f) =>
        allowed.includes(f) || f === detection.questionField || f === detection.answerField,
    );
    return choices.length >= 2 ? choices : noteType.fieldNames;
  }, [noteType, detection]);
  const hiddenCount = noteType.fieldNames.length - fieldChoices.length;

  const [answerField, setAnswerField] = useState(detection.answerField);
  const [questionFields, setQuestionFields] = useState<string[]>(() =>
    detection.questionField ? [detection.questionField] : [],
  );
  const [count, setCount] = useState(() => Math.min(20, noteType.noteCount));

  // The answer field can't also be a question field; keep prompt order = field order.
  const questionOptions = fieldChoices.filter((f) => f !== answerField);
  const selectedQuestionFields = questionOptions.filter((f) => questionFields.includes(f));
  const canStart = selectedQuestionFields.length > 0;
  const countOptions = COUNT_CHOICES.filter((c) => c < noteType.noteCount);

  function toggleQuestionField(field: string) {
    setQuestionFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }

  function handleStart() {
    const pool: QuizNote[] = noteType.notes.map((n, i) => ({
      id: n.ankiNoteId ?? `${noteType.id}-${i}`,
      fields: n.fields,
    }));
    const questions = buildQuestions(
      pool,
      count,
      { questionFields: selectedQuestionFields, answerField },
      pool,
    );
    onStart(questions);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{noteType.noteCount} notes available</span>
        <ConfidenceBadge confidence={detection.confidence} />
      </div>

      {detection.confidence < 0.7 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Detection is unsure about this note type — please check the question and answer fields.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Question — shown on the card</legend>
        <p className="text-xs text-neutral-500">
          Tick one or more fields to bundle into each prompt.
        </p>
        <div className="space-y-1.5">
          {questionOptions.map((f) => (
            <label
              key={f}
              className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 text-sm dark:border-neutral-800"
            >
              <input
                type="checkbox"
                checked={questionFields.includes(f)}
                onChange={() => toggleQuestionField(f)}
              />
              <span className="font-medium">{f}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FieldSelect
        label="Answer — the correct choice"
        value={answerField}
        fields={fieldChoices}
        sample={sampleValue(noteType.notes, answerField)}
        onChange={setAnswerField}
      />

      {hiddenCount > 0 && (
        <p className="text-xs text-neutral-500">
          {hiddenCount} metadata field{hiddenCount === 1 ? "" : "s"} (e.g. levels, counts) hidden —
          they don&apos;t make good quiz questions or answers.
        </p>
      )}

      {!canStart && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Pick at least one field for the question.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="quiz-count" className="text-sm font-medium">
          Questions
        </label>
        <select
          id="quiz-count"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
        >
          {countOptions.map((c) => (
            <option
              key={c}
              value={c}
              className="bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {c}
            </option>
          ))}
          <option
            value={noteType.noteCount}
            className="bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          >
            All {noteType.noteCount}
          </option>
        </select>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className="flex-1 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Start quiz
        </button>
      </div>
    </div>
  );
}
