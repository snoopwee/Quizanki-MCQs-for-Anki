"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/ui/controls";
import { AUTOPLAY_SPEEDS, type FlashcardPreferences } from "@/lib/flashcardPreferences";
import { TTS_LANGUAGE_OPTIONS, languageLabel } from "@/lib/ttsLanguages";

// Deck-level TTS language controls, shown only for saved decks. `term`/`def` are
// the current stored overrides ("" = auto-detect); `autoTerm`/`autoDef` are the
// detected majority languages, surfaced in the Auto-detect option label.
export interface DeckLanguageControls {
  term: string;
  def: string;
  autoTerm: string;
  autoDef: string;
  saving?: boolean;
  onChange: (face: "front" | "back", code: string) => void;
}

// The Knowt-style "Flashcards Options" modal for the flashcard study screen.
// Question Format picks which side shows first; Learning Options toggle the
// session behaviours. All changes apply live (the player reads the same prefs);
// "Save options" just closes, "Restart flashcards" resets position + sorting.
export function FlashcardsOptionsModal({
  prefs,
  onChange,
  starredAvailable,
  language,
  onSave,
  onRestart,
  onClose,
}: {
  prefs: FlashcardPreferences;
  onChange: (patch: Partial<FlashcardPreferences>) => void;
  // False when the deck has no starred cards yet — disables "Study starred only".
  starredAvailable: boolean;
  // Deck-level TTS language controls; absent for the guest/unsaved flow.
  language?: DeckLanguageControls;
  onSave: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  // The two Question-Format toggles are really one choice (which side faces up),
  // mirrored from Knowt. "Definition first" = front (the term/prompt side).
  const definitionFirst = prefs.startSide === "front";
  const termFirst = prefs.startSide === "back";

  return (
    <Modal title="Flashcards Options" onClose={onClose}>
      <div className="space-y-6">
        <Section label="Question Format">
          <Row
            title="Answer with Term"
            help="Show the definition side first; you recall the term."
            on={termFirst}
            onChange={(v) => onChange({ startSide: v ? "back" : "front" })}
          />
          <Row
            title="Answer with Definition"
            help="Show the term side first; you recall the definition."
            on={definitionFirst}
            onChange={(v) => onChange({ startSide: v ? "front" : "back" })}
          />
        </Section>

        <div className="h-px bg-line" />

        <Section label="Learning Options">
          <Row
            title="Cards sorting"
            help="Mark each card Know / Still-learning as you go."
            on={prefs.cardSorting}
            onChange={(v) => onChange({ cardSorting: v })}
          />
          <Row
            title="Study starred terms only"
            help={starredAvailable ? "Limit the deck to cards you've starred." : "Star some cards first to use this."}
            on={prefs.starredOnly && starredAvailable}
            disabled={!starredAvailable}
            onChange={(v) => onChange({ starredOnly: v })}
          />
          <Row
            title="Shuffle terms"
            help="Randomise the card order each run."
            on={prefs.shuffle}
            onChange={(v) => onChange({ shuffle: v })}
          />
        </Section>

        <div className="h-px bg-line" />

        <Section label="Playback">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">Autoplay speed</div>
              <div className="mt-0.5 text-xs text-muted">
                How long each side is held before autoplay flips / advances.
              </div>
            </div>
            <select
              value={prefs.autoplaySeconds}
              onChange={(e) => onChange({ autoplaySeconds: Number(e.target.value) })}
              className="focus-ring shrink-0 rounded-input border border-line-strong bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none"
            >
              {AUTOPLAY_SPEEDS.map((s) => (
                <option key={s.seconds} value={s.seconds}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </Section>

        {language && (
          <>
            <div className="h-px bg-line" />
            <Section label="Pronunciation">
              <p className="-mt-1 text-xs text-muted">
                The voice used for Listen (text-to-speech). Auto-detect guesses from the text —
                override it if a language is read wrong (e.g. kanji read as Chinese).
              </p>
              <LanguageRow
                title="Term language"
                help="The front side of each card."
                value={language.term}
                autoDetected={language.autoTerm}
                disabled={language.saving}
                onChange={(code) => language.onChange("front", code)}
              />
              <LanguageRow
                title="Definition language"
                help="The back side of each card."
                value={language.def}
                autoDetected={language.autoDef}
                disabled={language.saving}
                onChange={(code) => language.onChange("back", code)}
              />
            </Section>
          </>
        )}

        <div className="h-px bg-line" />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSave}
            className="focus-ring rounded-input px-1 text-sm font-semibold text-accent transition hover:opacity-80"
          >
            Save options
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="focus-ring rounded-input px-1 text-sm font-semibold text-danger transition hover:opacity-80"
          >
            Restart flashcards
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink">{label}</h3>
      {children}
    </div>
  );
}

function Row({
  title,
  help,
  on,
  disabled = false,
  onChange,
}: {
  title: string;
  help?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-4 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{title}</div>
        {help && <div className="mt-0.5 text-xs text-muted">{help}</div>}
      </div>
      <Toggle on={on} disabled={disabled} onChange={onChange} />
    </div>
  );
}

// A per-face language <select>. The Auto-detect option surfaces the detected
// language (e.g. "Auto-detect (Japanese)") so the learner can see the current
// guess before deciding to override it.
function LanguageRow({
  title,
  help,
  value,
  autoDetected,
  disabled = false,
  onChange,
}: {
  title: string;
  help?: string;
  value: string;
  autoDetected: string;
  disabled?: boolean;
  onChange: (code: string) => void;
}) {
  return (
    <div className={`flex items-center gap-4 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{title}</div>
        {help && <div className="mt-0.5 text-xs text-muted">{help}</div>}
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring shrink-0 rounded-input border border-line-strong bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none disabled:opacity-50"
      >
        {TTS_LANGUAGE_OPTIONS.map((o) => (
          <option key={o.code || "auto"} value={o.code}>
            {o.code === "" && autoDetected
              ? `Auto-detect (${languageLabel(autoDetected)})`
              : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
