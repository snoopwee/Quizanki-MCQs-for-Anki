"use client";

import { extraFields, isFieldShown, withExtraField } from "@/lib/cardFields";

// One note type's field layout, in the shape both the deck page (from deck
// contents) and the edit page (from its layout state) can supply.
export interface FieldNoteType {
  id: string;
  name: string;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  cloze?: boolean;
}

// The "show / hide extra fields" control, shared by the deck page (Flashcards
// Options modal) and the edit page. The term and primary definition are fixed;
// every other imported field gets a checkbox that adds it to / removes it from the
// definition side. Renders nothing when no note type has any extra field to toggle
// (so single-field decks don't show an empty control).
export function CardFieldsControl({
  noteTypes,
  disabled = false,
  onChange,
}: {
  noteTypes: FieldNoteType[];
  disabled?: boolean;
  onChange: (typeId: string, next: { frontFields: string[]; backFields: string[] }) => void;
}) {
  const withExtras = noteTypes.filter(
    (nt) => !nt.cloze && extraFields(nt.fieldNames, nt.frontFields, nt.backFields).length > 0,
  );
  if (withExtras.length === 0) return null;

  return (
    <div className="space-y-4">
      {withExtras.map((nt) => {
        const extras = extraFields(nt.fieldNames, nt.frontFields, nt.backFields);
        return (
          <div key={nt.id} className="space-y-2">
            {withExtras.length > 1 && (
              <div className="font-mono text-xs font-medium text-muted">{nt.name}</div>
            )}
            <p className="text-xs text-muted">
              Always shown:{" "}
              <span className="font-medium text-ink">{nt.frontFields.join(", ") || "—"}</span> (term) ·{" "}
              <span className="font-medium text-ink">{nt.backFields[0] ?? "—"}</span> (definition). Add
              more fields to the definition side:
            </p>
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
                    onChange={(e) =>
                      onChange(
                        nt.id,
                        withExtraField(f, nt.fieldNames, nt.frontFields, nt.backFields, e.target.checked),
                      )
                    }
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
