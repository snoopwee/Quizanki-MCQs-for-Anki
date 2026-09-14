"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { detectFields, selectableFields } from "@/lib/detectFields";
import { buildMixedQuestions, type Question } from "@/lib/buildQuestions";
import {
  buildAllCardsSpecs,
  cardsInType,
  collectStarredIds,
  collectWeakIds,
  countCardsIn,
  initialPrefsByType,
  initialPrefsForType,
  isQuizable,
  totalCardsAcrossTypes,
  type NoteStatsLookup,
} from "@/lib/quizDeckSpecs";
import {
  loadQuizPreferences,
  saveQuizPreferences,
  type NoteTypeFieldPrefs,
  type QuizPreferences,
} from "@/lib/quizPreferences";
import { toggleQuestionKind, type QuestionKind } from "@/lib/questionTypes";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FieldSelect } from "@/components/deck/FieldSelect";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { QuestionTypeChips } from "@/components/quiz/QuestionTypeChips";
import { buttonClasses } from "@/components/ui/Button";
import { Segmented, SoonTag } from "@/components/ui/controls";
import type { ApkgNoteType, ApkgParseResponse } from "@/types/api";

// The deck helpers (quizable check, stats lookup, spec building) live in
// lib/quizDeckSpecs.ts so Learn shares them; the lookup type stays importable here.
export type { NoteStatsLookup };

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
    // Canonical order, and never empty (switching off the last one is a no-op).
    setEnabledKinds((prev) => toggleQuestionKind(prev, kind));
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
        <QuestionTypeChips enabled={enabledKinds} onToggle={toggleKind} />
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
          <div className="font-mono text-[0.6875rem] uppercase tracking-wide text-faint">Ready</div>
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
          <div className="text-[0.9375rem] font-bold text-ink">{title}</div>
          {desc && <div className="mt-0.5 text-xs text-muted">{desc}</div>}
        </div>
        {soon && <SoonTag className="mt-0.5 shrink-0" />}
      </div>
      {children}
    </Card>
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
