"use client";

import { useState, type ReactNode } from "react";
import { canSwapRow, fieldLabel, type EditorRow } from "@/lib/deckEditor";
import { TTS_LANGUAGE_OPTIONS } from "@/lib/ttsLanguages";

// One card's editable body, shared by the saved-deck editor
// (app/(app)/decks/[deckId]/edit) and the pre-save import review screen so the
// two feel like the same tool. Each page keeps its own list/toolbar around it —
// only the saved-deck editor has note ids, layout swaps and drag reorder.
//
// Focusing a field reveals a "voice" (TTS language) menu for that side; an
// already-set override stays visible so it's discoverable at a glance.

export interface EditableCardProps {
  row: EditorRow;
  index: number;
  onField: (key: string, field: string, value: string) => void;
  onSwap: (key: string) => void;
  onDelete: (key: string) => void;
  onLang: (key: string, face: "front" | "back", code: string) => void;
}

export function EditableCard({ row, index, onField, onSwap, onDelete, onLang }: EditableCardProps) {
  const [activeField, setActiveField] = useState<string | null>(null);
  // The field rows that carry the term (front) and definition (back) language.
  const termField = row.frontFields[0] ?? row.fieldNames[0];
  const defField = row.backFields[0] ?? row.fieldNames.find((f) => f !== termField) ?? termField;

  return (
    <>
      <div className="flex items-center gap-2 font-mono text-xs text-faint">
        <span>#{index + 1}</span>
        {row.cloze && (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Cloze
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {canSwapRow(row) && (
            <IconBtn label="Swap front/back" onClick={() => onSwap(row.key)}>⇅</IconBtn>
          )}
          <IconBtn label="Delete card" danger onClick={() => onDelete(row.key)}>✕</IconBtn>
        </div>
      </div>
      {/* Clearing activeField only when focus leaves the whole card keeps the menu
          open while you're picking a language from its <select>. */}
      <div
        className="space-y-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveField(null);
        }}
      >
        {row.fieldNames.map((field) => {
          const showTerm = field === termField;
          const showDef = field === defField;
          // Reveal the menu when this field is focused, or when its side already
          // carries an override (so the setting stays visible when unfocused).
          const showMenu =
            activeField === field ||
            (showTerm && row.frontLang !== "") ||
            (showDef && row.backLang !== "");
          return (
            <div key={field} className="space-y-1">
              <div className="flex min-h-[1.5rem] items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-muted">{fieldLabel(field)}</span>
                {showMenu && (
                  <div className="flex items-center gap-1.5">
                    {showTerm && (
                      <LangSelect
                        label="Term voice"
                        value={row.frontLang}
                        onChange={(code) => onLang(row.key, "front", code)}
                      />
                    )}
                    {showDef && (
                      <LangSelect
                        label="Definition voice"
                        value={row.backLang}
                        onChange={(code) => onLang(row.key, "back", code)}
                      />
                    )}
                  </div>
                )}
              </div>
              <textarea
                value={row.fields[field] ?? ""}
                onFocus={() => setActiveField(field)}
                onChange={(e) => onField(row.key, field, e.target.value)}
                rows={row.cloze ? 3 : 2}
                className="nice-scroll focus-ring w-full cursor-text select-text resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none"
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// Compact per-face TTS-language picker shown on a field's label row. "" is
// Auto-detect (inherit the deck default); any other value overrides this card.
function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      <span className="hidden sm:inline">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring rounded border border-line-strong bg-surface px-1.5 py-0.5 text-xs text-ink outline-none"
      >
        {TTS_LANGUAGE_OPTIONS.map((o) => (
          <option key={o.code || "auto"} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function IconBtn({
  children,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-sm transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-30 ${
        danger ? "text-danger" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
