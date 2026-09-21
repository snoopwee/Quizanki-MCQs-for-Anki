"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/shared/Modal";
import { QuestionTypeChips } from "@/components/quiz/QuestionTypeChips";
import { Segmented, Toggle } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { toggleQuestionKind } from "@/lib/questionTypes";
import {
  LEARN_MIN_CARDS,
  effectiveLearnCount,
  type AnswerWith,
  type LearnPreferences,
} from "@/lib/learnPreferences";

// Learn's settings (Knowt-style): how many cards, which question types, which side to
// answer with, and the study options. Edits a draft; nothing changes until Start / Restart.
export function LearnSettingsModal({
  initial,
  available,
  starredCount,
  speechSupported,
  mode,
  onApply,
  onClose,
}: {
  initial: LearnPreferences;
  // Cards left to learn from under the given filters (cloze deletions count separately).
  available: (filters: { starredOnly: boolean; includeMastered: boolean }) => number;
  starredCount: number;
  speechSupported: boolean;
  // "start" before a session exists; "restart" replaces the one running.
  mode: "start" | "restart";
  onApply: (prefs: LearnPreferences) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LearnPreferences>(initial);
  // The raw count entry — NaN while the field is blank.
  const [countInput, setCountInput] = useState<number>(initial.count);
  const patch = (next: Partial<LearnPreferences>) => setDraft((d) => ({ ...d, ...next }));

  const pool = available({ starredOnly: draft.starredOnly, includeMastered: draft.includeMastered });
  const effective = effectiveLearnCount(countInput, pool);
  const belowMinimum = !Number.isFinite(countInput) || countInput < LEARN_MIN_CARDS;

  let countNote: string;
  if (pool === 0) countNote = "No cards match these settings.";
  else if (pool < LEARN_MIN_CARDS)
    countNote = `Only ${pool} card${pool === 1 ? "" : "s"} match, so you'll learn all of them.`;
  else if (belowMinimum)
    countNote = `A session learns at least ${LEARN_MIN_CARDS} cards, so this one starts with ${effective}.`;
  else if (countInput > pool) countNote = `Only ${pool} cards match, so this one learns all ${pool}.`;
  else countNote = `${pool} cards available.`;
  const countWarns = pool === 0 || (belowMinimum && pool >= LEARN_MIN_CARDS);

  function apply() {
    if (pool === 0) return;
    // Remember what was typed (raised to the minimum), not the capped number — a bigger
    // set next time shouldn't be held to this one's size.
    const count = Number.isFinite(countInput) ? Math.max(LEARN_MIN_CARDS, Math.floor(countInput)) : LEARN_MIN_CARDS;
    onApply({ ...draft, count });
  }

  return (
    <Modal title="Learn settings" onClose={onClose}>
      <div className="space-y-5">
        <Setting
          title="Cards per session"
          desc={
            draft.retryMissed
              ? "Missed cards come back until you get them right, so a session ends once every card is learned."
              : "Each card is asked once, so a session ends after this many questions."
          }
        >
          <input
            type="number"
            min={LEARN_MIN_CARDS}
            inputMode="numeric"
            value={Number.isFinite(countInput) ? countInput : ""}
            onChange={(e) =>
              setCountInput(e.target.value === "" ? NaN : Math.floor(Number(e.target.value)))
            }
            aria-label="Cards per session"
            className="focus-ring w-28 rounded-input border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink"
          />
          <p className={`mt-2 text-xs ${countWarns ? "text-warning" : "text-muted"}`}>{countNote}</p>
        </Setting>

        <Setting title="Question types" desc="Each time a card comes up, it's asked in one of these.">
          <QuestionTypeChips
            enabled={draft.kinds}
            onToggle={(kind) => patch({ kinds: toggleQuestionKind(draft.kinds, kind) })}
          />
        </Setting>

        <Setting
          title="Answer with"
          desc={
            draft.answerWith === "definition"
              ? "See the term, answer with its definition."
              : "See the definition, answer with the term. Cloze cards are always asked as written."
          }
        >
          <Segmented<AnswerWith>
            value={draft.answerWith}
            onChange={(answerWith) => patch({ answerWith })}
            options={[
              { value: "definition", label: "Definition" },
              { value: "term", label: "Term" },
            ]}
          />
        </Setting>

        <div className="divide-y divide-line rounded-card border border-line">
          <ToggleRow
            label="Starred cards only"
            desc={starredCount > 0 ? `${starredCount} starred card${starredCount === 1 ? "" : "s"}.` : "Star some cards to use this."}
            on={draft.starredOnly}
            disabled={starredCount === 0 && !draft.starredOnly}
            onChange={(starredOnly) => patch({ starredOnly })}
          />
          <ToggleRow
            label="Include mastered cards"
            desc="Turn off to skip cards you've already mastered."
            on={draft.includeMastered}
            onChange={(includeMastered) => patch({ includeMastered })}
          />
          <ToggleRow
            label="Shuffle"
            desc="Turn off to go through cards in deck order."
            on={draft.shuffle}
            onChange={(shuffle) => patch({ shuffle })}
          />
          <ToggleRow
            label="Bring back missed cards"
            desc="Ask a missed card again later in the session until you get it right."
            on={draft.retryMissed}
            onChange={(retryMissed) => patch({ retryMissed })}
          />
          <ToggleRow
            label="Re-type wrong written answers"
            desc="Type the correct answer before moving on."
            on={draft.retypeWrong}
            onChange={(retypeWrong) => patch({ retypeWrong })}
          />
          <ToggleRow
            label="Smart grading"
            desc="Forgive small typos in longer written answers."
            on={draft.smartGrading}
            onChange={(smartGrading) => patch({ smartGrading })}
          />
          <ToggleRow
            label="Read questions aloud"
            desc={speechSupported ? "Speak each question when it appears." : "This browser can't read text aloud."}
            on={draft.readAloud && speechSupported}
            disabled={!speechSupported}
            onChange={(readAloud) => patch({ readAloud })}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost" })}>
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={pool === 0}
            className={buttonClasses({ variant: "primary" })}
          >
            <Icon name="play" size={16} />
            {mode === "start" ? "Start learning" : "Restart session"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Setting({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5">
        <h3 className="text-[0.9375rem] font-bold text-ink">{title}</h3>
        {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

// One switch row. The whole row is the switch's label, so tapping the text toggles it and
// screen readers announce the label with the switch.
function ToggleRow({
  label,
  desc,
  on,
  disabled = false,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-4 px-4 py-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${disabled ? "text-faint" : "text-ink"}`}>{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{desc}</span>
      </span>
      <Toggle on={on} disabled={disabled} onChange={onChange} />
    </label>
  );
}
