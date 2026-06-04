"use client";

import { useEffect, useMemo, useState } from "react";
import { detectFields, selectableFields } from "@/lib/detectFields";
import {
  buildMixedQuestions,
  detectClozeField,
  type NoteTypeQuizSpec,
  type Question,
  type QuizNote,
} from "@/lib/buildQuestions";
import { uniqueClozeIndices } from "@/lib/cloze";
import {
  loadQuizPreferences,
  saveQuizPreferences,
  type NoteTypeFieldPrefs,
  type QuizPreferences,
} from "@/lib/quizPreferences";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FieldSelect } from "@/components/deck/FieldSelect";
import type { ApkgNoteType, ApkgParseResponse } from "@/types/api";

// A note type can power a multiple-choice quiz when:
//   - it's a cloze type with at least one cloze deletion in any note, OR
//   - it has at least two text fields (prompt + answer) and at least one note.
function isQuizable(t: ApkgNoteType): boolean {
  if (t.noteCount === 0) return false;
  if (t.cloze) return detectClozeField(t.fieldNames, t.notes) !== null;
  return t.fieldNames.length >= 2;
}

// Stats lookup used by the mastery-weighted card selection. The caller is
// responsible for sourcing the data — authed callers build it from card_stats
// returned by /decks/{id}/notes; the guest trial reads from localStorage.
// Returning undefined / a zero record both mean "treat as a new card."
export type NoteStatsLookup = (noteId: string) =>
  | { mastery: number; timesSeen: number; starred?: boolean }
  | undefined;

export function ApkgQuizSetup({
  parsed,
  onStart,
  onBack,
  getStats,
  deckId,
  showHeading = true,
  backLabel = "Back",
  startLabel = "Start quiz",
}: {
  parsed: ApkgParseResponse;
  onStart: (questions: Question[]) => void;
  onBack: () => void;
  getStats?: NoteStatsLookup;
  // When provided, the form's selections (per-type field picks + count) are
  // persisted to localStorage per deck and rehydrated on next visit.
  deckId?: string;
  showHeading?: boolean;
  backLabel?: string;
  startLabel?: string;
}) {
  const quizable = useMemo(() => parsed.noteTypes.filter(isQuizable), [parsed]);
  const basicTypes = useMemo(() => quizable.filter((t) => !t.cloze), [quizable]);
  const clozeTypes = useMemo(() => quizable.filter((t) => t.cloze), [quizable]);

  // Load saved prefs once on mount so the initial form matches what the user
  // last started with. Stale references (a field renamed after a re-import)
  // get dropped by the validation step below.
  const savedPrefs = useMemo<QuizPreferences | null>(
    () => (deckId ? loadQuizPreferences(deckId) : null),
    [deckId],
  );

  // Per-basic-type field state. Each type is independent — customizing one
  // doesn't ripple into the others.
  const [perTypePrefs, setPerTypePrefs] = useState<Record<string, NoteTypeFieldPrefs>>(
    () => initialPrefsByType(basicTypes, savedPrefs),
  );

  // If basicTypes change (rare — e.g. quizable set changes after a re-import),
  // re-seed prefs for any missing keys. Don't blow away user choices already in state.
  useEffect(() => {
    setPerTypePrefs((prev) => {
      let mutated = false;
      const next = { ...prev };
      for (const nt of basicTypes) {
        const k = String(nt.id);
        if (!next[k]) {
          next[k] = initialPrefsForType(nt, savedPrefs);
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [basicTypes, savedPrefs]);

  const totalCards = useMemo(() => totalCardsAcrossTypes(quizable), [quizable]);

  // Starred-only quiz: the set of starred note keys (same id scheme the pool
  // uses) and how many cards that subset yields. Empty when no stats lookup or
  // nothing is starred, which disables the toggle.
  const [starredOnly, setStarredOnly] = useState(false);
  const starredIds = useMemo(() => collectStarredIds(quizable, getStats), [quizable, getStats]);
  const starredCardCount = useMemo(
    () => countStarredCards(quizable, starredIds),
    [quizable, starredIds],
  );
  const availableTotal = starredOnly ? starredCardCount : totalCards;

  const [countText, setCountText] = useState(() =>
    String(clampCount(savedPrefs?.count ?? 20, totalCards || 1)),
  );
  const count = clampCount(Number(countText) || 1, Math.max(availableTotal, 1));

  if (quizable.length === 0) {
    return (
      <div className="space-y-5">
        {showHeading && <h1 className="text-2xl font-semibold">Set up a quiz</h1>}
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          None of the note types in <span className="font-medium">{parsed.filename}</span> have
          enough quizzable content. Decks with only single-field or image-only note types
          aren&apos;t supported.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  // A basic note type only contributes questions when at least one question
  // field is ticked. A cloze type always contributes. The Start button is
  // enabled when the union produces at least one contributing type.
  const usableBasic = basicTypes.filter(
    (nt) => (perTypePrefs[String(nt.id)]?.questionFields.length ?? 0) > 0,
  );
  const canStart = usableBasic.length + clozeTypes.length > 0 && availableTotal > 0;

  function handleStart() {
    const specs = buildAllCardsSpecs(quizable, perTypePrefs, getStats);
    if (specs.length === 0) return;
    // Pass the starred subset as the askable set; distractors still come from
    // every note (the full-pool rule lives inside buildMixedQuestions).
    const eligible = starredOnly ? starredIds : undefined;
    const questions = buildMixedQuestions(specs, count, undefined, eligible);
    if (deckId) {
      saveQuizPreferences(deckId, { count, fieldPrefs: perTypePrefs });
    }
    onStart(questions);
  }

  function updateTypePrefs(typeId: string, patch: Partial<NoteTypeFieldPrefs>) {
    setPerTypePrefs((prev) => ({
      ...prev,
      [typeId]: { ...prev[typeId], ...patch },
    }));
  }

  return (
    <div className="space-y-5">
      {showHeading && <h1 className="text-2xl font-semibold">Set up a quiz</h1>}

      <p className="text-sm text-neutral-500">
        Drawing from {quizable.length} note type{quizable.length === 1 ? "" : "s"} ·{" "}
        {availableTotal} {starredOnly ? "starred " : ""}card{availableTotal === 1 ? "" : "s"} available
      </p>

      {basicTypes.map((nt) => (
        <BasicTypeSection
          key={nt.id}
          noteType={nt}
          prefs={perTypePrefs[String(nt.id)]}
          onPatch={(patch) => updateTypePrefs(String(nt.id), patch)}
          showName={quizable.length > 1}
        />
      ))}

      {clozeTypes.length > 0 && (
        <div className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="text-sm font-medium">
            {clozeTypes.length === 1 ? clozeTypes[0].name : "Cloze note types"}
          </h3>
          <ul className="space-y-1 text-xs text-neutral-500">
            {clozeTypes.map((nt) => (
              <li key={nt.id}>
                {nt.name} · {cardsInType(nt)} cloze card{cardsInType(nt) === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Each <code>{`{{c1::...}}`}</code> deletion becomes one quiz card. No field picker
            needed — the cloze text is the prompt.
          </p>
        </div>
      )}

      <StarredOnlyToggle
        checked={starredOnly}
        starredCount={starredCardCount}
        enabled={starredIds.size > 0}
        onChange={setStarredOnly}
      />

      <CountInput
        countText={countText}
        setCountText={setCountText}
        rolledCount={count}
        max={availableTotal}
      />

      {!canStart && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Pick at least one question field for each note type you want to include.
        </p>
      )}

      <SetupActions
        onBack={onBack}
        backLabel={backLabel}
        startLabel={startLabel}
        canStart={canStart}
        onStart={handleStart}
      />
    </div>
  );
}

function BasicTypeSection({
  noteType,
  prefs,
  onPatch,
  showName,
}: {
  noteType: ApkgNoteType;
  prefs: NoteTypeFieldPrefs | undefined;
  onPatch: (patch: Partial<NoteTypeFieldPrefs>) => void;
  // Hide the note-type name header when the deck has only one quizable type —
  // the section is the whole screen, no need for a chip restating "Basic".
  showName: boolean;
}) {
  const detection = useMemo(
    () => detectFields(noteType.notes, noteType.fieldNames),
    [noteType],
  );
  const hasTemplate = noteType.frontFields.length > 0 || noteType.backFields.length > 0;

  const fieldChoices = useMemo(() => {
    const allowed = selectableFields(noteType.notes, noteType.fieldNames);
    const keep = new Set([
      ...allowed,
      ...noteType.frontFields,
      ...noteType.backFields,
      detection.questionField,
      detection.answerField,
    ]);
    const choices = noteType.fieldNames.filter((f) => keep.has(f));
    return choices.length >= 2 ? choices : noteType.fieldNames;
  }, [noteType, detection]);

  const safePrefs = prefs ?? { questionFields: [], answerField: fieldChoices[0] ?? "" };
  const answerField = safePrefs.answerField;
  const questionOptions = fieldChoices.filter((f) => f !== answerField);

  function toggle(field: string) {
    const next = safePrefs.questionFields.includes(field)
      ? safePrefs.questionFields.filter((f) => f !== field)
      : [...safePrefs.questionFields, field];
    onPatch({ questionFields: next });
  }

  function setAnswerField(next: string) {
    // Drop the new answer field from the question selection so the same field
    // isn't both the prompt and the answer.
    const cleanedQuestions = safePrefs.questionFields.filter((f) => f !== next);
    onPatch({ answerField: next, questionFields: cleanedQuestions });
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      {showName && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{noteType.name}</h3>
          {!hasTemplate && <ConfidenceBadge confidence={detection.confidence} />}
        </div>
      )}
      {!showName && !hasTemplate && (
        <div className="flex justify-end">
          <ConfidenceBadge confidence={detection.confidence} />
        </div>
      )}

      {hasTemplate ? (
        <p className="text-xs text-neutral-500">
          Pre-filled from the deck&apos;s card layout — adjust if needed.
        </p>
      ) : (
        detection.confidence < 0.7 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Detection is unsure — please check the question and answer fields.
          </p>
        )
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
                checked={safePrefs.questionFields.includes(f)}
                onChange={() => toggle(f)}
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
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function CountInput({
  countText,
  setCountText,
  rolledCount,
  max,
}: {
  countText: string;
  setCountText: (s: string) => void;
  rolledCount: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="quiz-count" className="text-sm font-medium">
        Questions
      </label>
      <input
        id="quiz-count"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={countText}
        onChange={(e) => setCountText(e.target.value.replace(/\D/g, ""))}
        onBlur={() => setCountText(String(rolledCount))}
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
      />
      <p className="text-xs text-neutral-500">How many questions to take — 1 to {max}.</p>
    </div>
  );
}

function StarredOnlyToggle({
  checked,
  starredCount,
  enabled,
  onChange,
}: {
  checked: boolean;
  starredCount: number;
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <label className={`flex items-center gap-2 text-sm ${enabled ? "" : "opacity-60"}`}>
        <input
          type="checkbox"
          checked={checked && enabled}
          disabled={!enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="font-medium">
          <span className="text-amber-500" aria-hidden>
            ★
          </span>{" "}
          Starred cards only
        </span>
        {enabled && (
          <span className="text-xs text-neutral-500">
            {starredCount} card{starredCount === 1 ? "" : "s"}
          </span>
        )}
      </label>
      {!enabled && (
        <p className="mt-1 pl-6 text-xs text-neutral-500">
          Star cards on the flashcard list or during a quiz to use this.
        </p>
      )}
    </div>
  );
}

function SetupActions({
  onBack,
  backLabel,
  startLabel,
  canStart,
  onStart,
}: {
  onBack: () => void;
  backLabel: string;
  startLabel: string;
  canStart: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {backLabel}
      </button>
      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="flex-1 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {startLabel}
      </button>
    </div>
  );
}

function clampCount(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (max <= 0) return 1;
  return Math.min(max, Math.max(1, Math.round(n)));
}

function sampleValue(notes: ApkgNoteType["notes"], field: string): string {
  const found = notes.find((n) => (n.fields[field] ?? "").length > 0);
  return found ? found.fields[field] : "(empty)";
}

function cardsInType(t: ApkgNoteType): number {
  if (!t.cloze) return t.noteCount;
  const field = detectClozeField(t.fieldNames, t.notes);
  if (!field) return 0;
  let total = 0;
  for (const n of t.notes) {
    total += uniqueClozeIndices(n.fields[field] ?? "").length;
  }
  return total;
}

function totalCardsAcrossTypes(types: ApkgNoteType[]): number {
  return types.reduce((acc, t) => acc + cardsInType(t), 0);
}

// The id a note is tracked by, matching buildFlashcards / the quiz pool: the
// persisted UUID for saved decks, else the Anki note id, else a synthetic key.
// One lookup then serves the flashcard list, the quiz, and starred selection.
function noteKey(noteType: ApkgNoteType, note: ApkgNoteType["notes"][number], i: number): string {
  return note.id ?? note.ankiNoteId ?? `${noteType.id}-${i}`;
}

function buildPool(
  noteType: ApkgNoteType,
  getStats: NoteStatsLookup | undefined,
): QuizNote[] {
  return noteType.notes.map((n, i) => {
    const id = noteKey(noteType, n, i);
    const stats = getStats?.(id);
    return {
      id,
      fields: n.fields,
      mastery: stats?.mastery ?? 0,
      timesSeen: stats?.timesSeen ?? 0,
    };
  });
}

// Note keys the user has starred, across every quizable type. Empty when there's
// no stats lookup (guest with no stars yet, or a caller that doesn't track them).
function collectStarredIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!getStats) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      if (getStats(noteKey(nt, n, i))?.starred) ids.add(noteKey(nt, n, i));
    });
  }
  return ids;
}

// How many quiz cards the starred subset yields — a starred cloze note still
// contributes one card per deletion, mirroring cardsInType.
function countStarredCards(types: ApkgNoteType[], starredIds: Set<string>): number {
  let total = 0;
  for (const nt of types) {
    const clozeField = nt.cloze ? detectClozeField(nt.fieldNames, nt.notes) : null;
    nt.notes.forEach((n, i) => {
      if (!starredIds.has(noteKey(nt, n, i))) return;
      total += clozeField ? uniqueClozeIndices(n.fields[clozeField] ?? "").length : 1;
    });
  }
  return total;
}

function initialPrefsForType(
  nt: ApkgNoteType,
  saved: QuizPreferences | null,
): NoteTypeFieldPrefs {
  const restored = restoreFieldPrefs(saved?.fieldPrefs[String(nt.id)], nt.fieldNames);
  if (restored) return restored;
  const detection = detectFields(nt.notes, nt.fieldNames);
  const answerField = nt.backFields[0] ?? detection.answerField ?? nt.fieldNames[1] ?? "";
  const questionFields =
    nt.frontFields.length > 0
      ? nt.frontFields
      : detection.questionField
        ? [detection.questionField]
        : [];
  return {
    questionFields: questionFields.filter((f) => f !== answerField),
    answerField,
  };
}

function initialPrefsByType(
  basicTypes: ApkgNoteType[],
  saved: QuizPreferences | null,
): Record<string, NoteTypeFieldPrefs> {
  const out: Record<string, NoteTypeFieldPrefs> = {};
  for (const nt of basicTypes) {
    out[String(nt.id)] = initialPrefsForType(nt, saved);
  }
  return out;
}

function restoreFieldPrefs(
  saved: NoteTypeFieldPrefs | undefined,
  liveFields: string[],
): NoteTypeFieldPrefs | null {
  if (!saved) return null;
  const live = new Set(liveFields);
  if (!live.has(saved.answerField)) return null;
  const questionFields = saved.questionFields.filter(
    (f) => live.has(f) && f !== saved.answerField,
  );
  if (questionFields.length === 0) return null;
  return { questionFields, answerField: saved.answerField };
}

function buildAllCardsSpecs(
  quizable: ApkgNoteType[],
  perTypePrefs: Record<string, NoteTypeFieldPrefs>,
  getStats: NoteStatsLookup | undefined,
): NoteTypeQuizSpec[] {
  const specs: NoteTypeQuizSpec[] = [];
  for (const nt of quizable) {
    const pool = buildPool(nt, getStats);
    if (nt.cloze) {
      const textField = detectClozeField(nt.fieldNames, nt.notes);
      if (!textField) continue;
      specs.push({ kind: "cloze", noteTypeId: String(nt.id), textField, notes: pool });
      continue;
    }
    const prefs = perTypePrefs[String(nt.id)];
    if (!prefs || prefs.questionFields.length === 0 || !prefs.answerField) continue;
    specs.push({
      kind: "basic",
      noteTypeId: String(nt.id),
      questionFields: prefs.questionFields,
      answerField: prefs.answerField,
      notes: pool,
    });
  }
  return specs;
}
