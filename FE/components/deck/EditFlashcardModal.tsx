"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { fieldLabel } from "@/lib/deckEditor";
import { useUpdateNote } from "@/hooks/useNotes";

export interface EditableNote {
  noteId: string;
  noteType: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  fields: Record<string, string>;
}

// Per-flashcard editor: one textarea per field, seeded from the note's current
// values. Cloze note types keep their {{c1::...}} markup and get a hint so the
// user knows not to strip it. Saves through the note-update mutation, then closes.
export function EditFlashcardModal({
  deckId,
  note,
  onClose,
}: {
  deckId: string;
  note: EditableNote;
  onClose: () => void;
}) {
  const updateNote = useUpdateNote(deckId);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(note.fieldNames.map((f) => [f, note.fields[f] ?? ""])),
  );

  const dirty = note.fieldNames.some((f) => (note.fields[f] ?? "") !== values[f]);

  const frontField = note.frontFields[0];
  const backField = note.backFields[0];
  const canSwap =
    !note.cloze && Boolean(frontField) && Boolean(backField) && frontField !== backField;

  function handleSwap() {
    if (!canSwap) return;
    setValues((v) => ({
      ...v,
      [frontField]: v[backField] ?? "",
      [backField]: v[frontField] ?? "",
    }));
  }

  function handleSave() {
    updateNote.mutate(
      { noteId: note.noteId, fields: values },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal title="Edit flashcard" onClose={onClose}>
      <div className="space-y-4">
        <p className="font-mono text-xs text-muted">{note.noteType}</p>

        {note.cloze && (
          <p className="rounded-input border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
            This is a cloze card. Keep the <code>{"{{c1::answer}}"}</code> markers
            intact — each one becomes a separate question.
          </p>
        )}

        {canSwap && (
          <button
            type="button"
            onClick={handleSwap}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium transition hover:border-accent hover:text-accent"
          >
            ⇅ Swap front and back
          </button>
        )}

        {note.fieldNames.map((field) => (
          <label key={field} className="block space-y-1">
            <span className="text-sm font-medium">{fieldLabel(field)}</span>
            <textarea
              value={values[field]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field]: e.target.value }))
              }
              rows={field.toLowerCase().includes("back") || note.cloze ? 4 : 2}
              className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
            />
          </label>
        ))}

        {updateNote.isError && (
          <p className="text-sm text-danger">
            Couldn&apos;t save your changes. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={updateNote.isPending}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateNote.isPending || !dirty}
            className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
          >
            {updateNote.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
