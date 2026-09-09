"use client";

import { extraFields, isFieldShown, mergeIdenticalNoteTypes, withExtraField } from "@/lib/cardFields";
import type { FieldNoteType } from "@/components/deck/CardFieldsControl";

// The lightweight "show / hide extra fields" toggle used on the flashcard STUDY
// screen (Flashcards Options → Card fields), where there's no editable draft — only
// a live layout-save callback. The term and primary definition are fixed; every
// other field is a checkbox that adds it to / removes it from the definition side.
// The full editor (import review + edit page) uses CardFieldsControl instead, which
// can also move fields between sides and add/remove them.
export function FieldToggleControl({
  noteTypes,
  disabled = false,
  onChange,
}: {
  noteTypes: FieldNoteType[];
  disabled?: boolean;
  onChange: (typeId: string, next: { frontFields: string[]; backFields: string[] }) => void;
}) {
  const withExtras = mergeIdenticalNoteTypes(noteTypes).filter(
    (nt) => !nt.cloze && extraFields(nt.fieldNames, nt.frontFields, nt.backFields).length > 0,
  );
  if (withExtras.length === 0) return null;

  return (
    <div className="space-y-4">
      {withExtras.map((nt) => {
        const extras = extraFields(nt.fieldNames, nt.frontFields, nt.backFields);
        return (
          <div key={nt.ids.join(",")} className="space-y-2">
            {withExtras.length > 1 && (
              <div className="font-mono text-xs font-medium text-muted">{nt.name || "Cards"}</div>
            )}
            <div className="space-y-1.5">
              {extras.map((f) => (
                <label
                  key={f}
                  className={`flex items-center gap-2 rounded-input border border-line bg-surface p-2 text-sm transition ${
                    disabled ? "opacity-60" : "cursor-pointer hover:border-line-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isFieldShown(f, nt.backFields)}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = withExtraField(
                        f, nt.fieldNames, nt.frontFields, nt.backFields, e.target.checked,
                      );
                      nt.ids.forEach((id) => onChange(id, next));
                    }}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="font-medium">{f}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
