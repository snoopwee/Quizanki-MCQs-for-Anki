"use client";

import { useState } from "react";
import { mergeIdenticalNoteTypes } from "@/lib/cardFields";
import { fieldLabel, type FieldSide } from "@/lib/deckEditor";
import { Icon } from "@/components/ui/icons";

// One note type's field layout, in the shape both the review editor (from a draft's
// rows) and the saved-deck edit page (from its layout state) can supply.
export interface FieldNoteType {
  id: string;
  name: string;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  cloze?: boolean;
}

// The "Fields shown on card" control: two collapsible sections, Term and
// Definition, each a checkbox list of the note type's fields. Ticking a field under
// Term puts it on the term side; ticking it under Definition moves it there (the
// two are mutually exclusive); unticking removes it from the card (data kept). A
// card always keeps one field on each side, so the last one can't be unticked. New
// fields can be added per side and empty ones deleted. Fields whose content is media
// we lifted into the per-side image/audio slots are folded away (`mediaFields`) —
// shown as the slot, never as an empty text box. Structurally-identical note types
// collapse into one; every edit applies to all of them.
export function CardFieldsControl({
  noteTypes,
  mediaFields,
  hasData,
  onMove,
  onAddField,
  onDeleteField,
}: {
  noteTypes: FieldNoteType[];
  mediaFields: Map<string, Set<string>>;
  hasData: (typeId: string, field: string) => boolean;
  onMove: (typeIds: string[], field: string, side: FieldSide) => void;
  onAddField: (typeIds: string[], name: string, side: "term" | "definition") => void;
  onDeleteField: (typeIds: string[], field: string) => void;
}) {
  const merged = mergeIdenticalNoteTypes(noteTypes).filter((nt) => !nt.cloze);
  if (merged.length === 0) return null;

  return (
    <div className="space-y-5">
      {merged.map((nt) => {
        const folded = mediaFields.get(nt.id) ?? new Set<string>();
        const fields = nt.fieldNames.filter((f) => !folded.has(f));
        const front = nt.frontFields.filter((f) => !folded.has(f));
        const back = nt.backFields.filter((f) => !folded.has(f));

        return (
          <div key={nt.ids.join(",")} className="space-y-3">
            {merged.length > 1 && (
              <div className="font-mono text-xs font-medium text-muted">{nt.name || "Cards"}</div>
            )}
            <SideSection
              title="Term"
              side="term"
              fields={fields}
              onSide={front}
              lastOnSide={front.length <= 1}
              typeId={nt.id}
              hasData={hasData}
              onMove={(f, s) => onMove(nt.ids, f, s)}
              onAdd={(name) => onAddField(nt.ids, name, "term")}
              onDelete={(f) => onDeleteField(nt.ids, f)}
            />
            <SideSection
              title="Definition"
              side="definition"
              fields={fields}
              onSide={back}
              lastOnSide={back.length <= 1}
              typeId={nt.id}
              hasData={hasData}
              onMove={(f, s) => onMove(nt.ids, f, s)}
              onAdd={(name) => onAddField(nt.ids, name, "definition")}
              onDelete={(f) => onDeleteField(nt.ids, f)}
            />
          </div>
        );
      })}
    </div>
  );
}

// One collapsible side (Term or Definition): a header with a chevron and count, then
// a checkbox per field (ticked = on this side) and an "add field" row.
function SideSection({
  title,
  side,
  fields,
  onSide,
  lastOnSide,
  typeId,
  hasData,
  onMove,
  onAdd,
  onDelete,
}: {
  title: string;
  side: "term" | "definition";
  fields: string[];
  onSide: string[];
  lastOnSide: boolean;
  typeId: string;
  hasData: (typeId: string, field: string) => boolean;
  onMove: (field: string, side: FieldSide) => void;
  onAdd: (name: string) => void;
  onDelete: (field: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const onSet = new Set(onSide);
  const shownCount = onSide.length;

  return (
    <div className="rounded-input border border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-t-input px-3 py-2 text-left transition hover:bg-surface-2/50"
        aria-expanded={open}
      >
        <Icon name={open ? "chevronDown" : "chevronRight"} size={16} className="text-muted" />
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="ml-auto font-mono text-xs text-faint">{shownCount} shown</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line p-2">
          {fields.map((f) => {
            const checked = onSet.has(f);
            const pinned = checked && lastOnSide; // can't untick the last field on a side
            const deletable = !hasData(typeId, f) && !pinned;
            return (
              <div
                key={f}
                className="flex items-center gap-2 rounded-input px-2 py-1.5 text-sm transition hover:bg-surface-2/40"
              >
                <label className={`flex min-w-0 flex-1 items-center gap-2 ${pinned ? "" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pinned}
                    onChange={(e) => onMove(f, e.target.checked ? side : "off")}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 truncate font-medium">{fieldLabel(f)}</span>
                </label>
                <button
                  type="button"
                  aria-label={`Delete field ${fieldLabel(f)}`}
                  title={
                    deletable
                      ? "Delete this field"
                      : pinned
                        ? "A card needs at least one field on this side"
                        : "This field has content — untick it to hide it instead"
                  }
                  disabled={!deletable}
                  onClick={() => onDelete(f)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted transition hover:text-danger disabled:cursor-default disabled:opacity-25"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            );
          })}
          <AddFieldRow existing={fields} onAdd={onAdd} sideLabel={title} />
        </div>
      )}
    </div>
  );
}

// "＋ Add field" — name a new field on this side. It's added (empty) to every card of
// the type and shows on future cards.
function AddFieldRow({
  existing,
  onAdd,
  sideLabel,
}: {
  existing: string[];
  onAdd: (name: string) => void;
  sideLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const duplicate = existing.some((f) => f.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !duplicate;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-muted transition hover:text-accent"
      >
        <Icon name="plus" size={13} /> Add field to {sideLabel.toLowerCase()}
      </button>
    );
  }

  const submit = () => {
    if (!valid) return;
    onAdd(trimmed);
    setName("");
    setOpen(false);
  };

  return (
    <div className="space-y-1 px-1 py-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Field name (e.g. Example)"
          className="focus-ring min-w-0 flex-1 rounded border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="focus-ring rounded bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:opacity-95 disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {duplicate && <p className="text-xs text-danger">A field named “{trimmed}” already exists.</p>}
    </div>
  );
}
