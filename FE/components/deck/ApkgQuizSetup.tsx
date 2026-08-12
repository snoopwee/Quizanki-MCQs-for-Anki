"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { ALL_QUESTION_KINDS, type QuestionKind } from "@/lib/questionTypes";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FieldSelect } from "@/components/deck/FieldSelect";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { Segmented, SoonTag } from "@/components/ui/controls";
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

// Which slice of the deck the quiz draws its questions from.
export type QuizSource = "all" | "starred" | "weak";

export function ApkgQuizSetup({
  parsed,
  onStart,
  onBack,
  getStats,
  deckId,
  showHeading = true,
  backLabel = "Back",
  startLabel = "Start quiz",
  initialSource = "all",
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
  // Preselect the "Pull cards from" source — lets the Stats panel's
  // "Quiz weak cards" shortcut deep-link straight into the weak slice.
  initialSource?: QuizSource;
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

  // Enabled question formats. Each selected card is asked in one of these; the
  // set never empties (toggling off the last one is a no-op).
  const [enabledKinds, setEnabledKinds] = useState<QuestionKind[]>(
    () => savedPrefs?.kinds ?? ["mcq"],
  );
  function toggleKind(kind: QuestionKind) {
    setEnabledKinds((prev) => {
      const has = prev.includes(kind);
      if (has && prev.length === 1) return prev; // keep at least one on
      const next = has ? prev.filter((k) => k !== kind) : [...prev, kind];
      return ALL_QUESTION_KINDS.filter((k) => next.includes(k)); // canonical order
    });
  }

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

  // "Pull cards from" source. Starred = cards the learner flagged; weak = cards
  // seen but not yet mastered (mastery < 80). Each subset (and its card count)
  // is precomputed so we can show the size and disable a source that's empty.
  const [source, setSource] = useState<QuizSource>(initialSource);
  const starredIds = useMemo(() => collectStarredIds(quizable, getStats), [quizable, getStats]);
  const weakIds = useMemo(() => collectWeakIds(quizable, getStats), [quizable, getStats]);
  const starredCardCount = useMemo(() => countCardsIn(quizable, starredIds), [quizable, starredIds]);
  const weakCardCount = useMemo(() => countCardsIn(quizable, weakIds), [quizable, weakIds]);

  const eligibleIds = source === "starred" ? starredIds : source === "weak" ? weakIds : null;
  const availableTotal =
    source === "starred" ? starredCardCount : source === "weak" ? weakCardCount : totalCards;

  // Free-form question count — the learner types how many questions they want.
  // `count` holds the raw input (NaN while the field is being cleared); the
  // effective build count is clamped to what the source can actually supply
  // (you can't ask more unique cards than exist).
  const [count, setCount] = useState<number>(() => clampCount(savedPrefs?.count ?? 20, totalCards || 1));
  const effCount = clampCount(count, availableTotal);

  if (quizable.length === 0) {
    return (
      <div className="space-y-5">
        {showHeading && <h1 className="font-display text-2xl font-semibold tracking-tight">Set up a quiz</h1>}
        <p className="break-words rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          None of the note types in <span className="font-medium">{parsed.filename}</span> have
          enough quizzable content. Decks with only single-field or image-only note types
          aren&apos;t supported.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
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
    // Pass the chosen subset as the askable set; distractors still come from
    // every note (the full-pool rule lives inside buildMixedQuestions).
    const questions = buildMixedQuestions(
      specs,
      effCount,
      undefined,
      eligibleIds ?? undefined,
      enabledKinds,
    );
    if (deckId) {
      saveQuizPreferences(deckId, { count: effCount, fieldPrefs: perTypePrefs, kinds: enabledKinds });
    }
    onStart(questions);
  }

  function updateTypePrefs(typeId: string, patch: Partial<NoteTypeFieldPrefs>) {
    setPerTypePrefs((prev) => ({
      ...prev,
      [typeId]: { ...prev[typeId], ...patch },
    }));
  }

  const sourceNoun = source === "starred" ? "starred " : source === "weak" ? "still-learning " : "";

  return (
    <div className="space-y-4">
      {showHeading && (
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Set up your quiz</h1>
          <p className="break-words text-sm text-muted">
            Build a multiple-choice test from{" "}
            <span className="font-medium text-ink">{parsed.filename}</span>.
          </p>
        </div>
      )}

      {/* how many questions — free numeric entry */}
      <SettingCard
        title="How many questions?"
        desc={`${availableTotal} ${sourceNoun}card${availableTotal === 1 ? "" : "s"} in this set — enter how many questions you want.`}
      >
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={Number.isFinite(count) ? count : ""}
          onChange={(e) =>
            setCount(e.target.value === "" ? NaN : Math.max(1, Math.floor(Number(e.target.value))))
          }
          aria-label="Number of questions"
          className="focus-ring w-28 rounded-input border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink"
        />
      </SettingCard>

      {/* question types — mix any combination; each card is asked in one of them */}
      <SettingCard
        title="Question types"
        desc="Mix any combination — each card is asked in one of the enabled formats."
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {ALL_QUESTION_KINDS.map((kind) => (
            <QTypeChip
              key={kind}
              icon={KIND_META[kind].icon}
              label={KIND_META[kind].label}
              on={enabledKinds.includes(kind)}
              onClick={() => toggleKind(kind)}
            />
          ))}
        </div>
      </SettingCard>

      {/* pull cards from */}
      <SettingCard title="Pull cards from">
        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All cards" },
            { value: "starred", label: "Starred", disabled: starredIds.size === 0 },
            { value: "weak", label: "Still learning", disabled: weakIds.size === 0 },
          ]}
        />
        <p className="mt-2 text-xs text-muted">
          {availableTotal} card{availableTotal === 1 ? "" : "s"} in this set
          {(starredIds.size === 0 || weakIds.size === 0) &&
            " · star cards or answer a few to unlock the focused sets"}
          .
        </p>
      </SettingCard>

      {/* card fields — the real, deck-specific pickers */}
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
        <div className="space-y-2 rounded-card border border-line bg-surface p-4">
          <h3 className="text-sm font-medium">
            {clozeTypes.length === 1 ? clozeTypes[0].name : "Cloze note types"}
          </h3>
          <ul className="space-y-1 text-xs text-muted">
            {clozeTypes.map((nt) => (
              <li key={nt.id}>
                {nt.name} · {cardsInType(nt)} cloze card{cardsInType(nt) === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Each <code>{`{{c1::...}}`}</code> deletion becomes one quiz card. No field picker
            needed — the cloze text is the prompt.
          </p>
        </div>
      )}

      {!canStart && (
        <p className="text-sm text-danger">
          Pick at least one question field for each note type you want to include.
        </p>
      )}

      {/* start bar */}
      <div className="mt-2 flex items-center gap-3 rounded-card border border-line-strong bg-surface p-4 shadow-card">
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-wide text-faint">Ready</div>
          <div className="mt-0.5 truncate text-sm font-bold text-ink">
            {effCount} question{effCount === 1 ? "" : "s"} · untimed
          </div>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={onBack} className={buttonClasses({ variant: "ghost" })}>
          {backLabel}
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className={buttonClasses({ variant: "primary", size: "lg" })}
        >
          <Icon name="play" size={16} /> {startLabel}
        </button>
      </div>
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
    <div className="space-y-4 rounded-card border border-line bg-surface p-4">
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
        <p className="text-xs text-muted">
          Pre-filled from the deck&apos;s card layout — adjust if needed.
        </p>
      ) : (
        detection.confidence < 0.7 && (
          <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Detection is unsure — please check the question and answer fields.
          </p>
        )
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Question — shown on the card</legend>
        <p className="text-xs text-muted">
          Tick one or more fields to bundle into each prompt.
        </p>
        <div className="space-y-1.5">
          {questionOptions.map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-2 rounded-input border border-line bg-surface p-2 text-sm transition hover:border-line-strong"
            >
              <input
                type="checkbox"
                checked={safePrefs.questionFields.includes(f)}
                onChange={() => toggle(f)}
                className="h-4 w-4 accent-[var(--accent)]"
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

// A titled settings panel (reference exam-setup layout). `soon` tags the whole
// card as a not-yet-built control.
function SettingCard({
  title,
  desc,
  soon = false,
  children,
}: {
  title: string;
  desc?: string;
  soon?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-ink">{title}</div>
          {desc && <div className="mt-0.5 text-xs text-muted">{desc}</div>}
        </div>
        {soon && <SoonTag className="mt-0.5 shrink-0" />}
      </div>
      {children}
    </Card>
  );
}

// Icon + label for each question format, in canonical order.
const KIND_META: Record<QuestionKind, { icon: IconName; label: string }> = {
  mcq: { icon: "clipboard", label: "Multiple choice" },
  truefalse: { icon: "check", label: "True / false" },
  written: { icon: "pencil", label: "Written" },
};

// A question-format toggle. `on` shows the accent fill + a filled checkbox; off
// is a plain, clickable chip with an empty checkbox.
function QTypeChip({
  icon,
  label,
  on,
  onClick,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`focus-ring flex items-center gap-2.5 rounded-card border px-3.5 py-3 text-left transition ${
        on ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-line-strong"
      }`}
    >
      <span className={on ? "text-accent-ink" : "text-faint"}>
        <Icon name={icon} size={18} />
      </span>
      <span className={`text-sm font-semibold ${on ? "text-ink" : "text-muted"}`}>{label}</span>
      <span className="ml-auto">
        {on ? (
          <span className="grid h-[18px] w-[18px] place-items-center rounded-[6px] bg-accent text-white">
            <Icon name="check" size={12} />
          </span>
        ) : (
          <span className="block h-[18px] w-[18px] rounded-[6px] border border-line-strong" />
        )}
      </span>
    </button>
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

// Note keys the learner has seen but not yet mastered (mastery < 80). The
// "Still learning" source draws from these. Empty without a stats lookup, or
// for a learner who hasn't answered anything yet.
function collectWeakIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!getStats) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      const key = noteKey(nt, n, i);
      const stats = getStats(key);
      if (stats && stats.timesSeen > 0 && stats.mastery < 80) ids.add(key);
    });
  }
  return ids;
}

// How many quiz cards a given id subset yields — a cloze note still contributes
// one card per deletion, mirroring cardsInType.
function countCardsIn(types: ApkgNoteType[], idSet: Set<string>): number {
  let total = 0;
  for (const nt of types) {
    const clozeField = nt.cloze ? detectClozeField(nt.fieldNames, nt.notes) : null;
    nt.notes.forEach((n, i) => {
      if (!idSet.has(noteKey(nt, n, i))) return;
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
