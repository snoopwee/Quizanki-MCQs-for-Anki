"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/ui/controls";
import type { FlashcardPreferences } from "@/lib/flashcardPreferences";

// The Knowt-style "Flashcards Options" modal for the flashcard study screen.
// Question Format picks which side shows first; Learning Options toggle the
// session behaviours. All changes apply live (the player reads the same prefs);
// "Save options" just closes, "Restart flashcards" resets position + sorting.
export function FlashcardsOptionsModal({
  prefs,
  onChange,
  starredAvailable,
  onSave,
  onRestart,
  onClose,
}: {
  prefs: FlashcardPreferences;
  onChange: (patch: Partial<FlashcardPreferences>) => void;
  // False when the deck has no starred cards yet — disables "Study starred only".
  starredAvailable: boolean;
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
