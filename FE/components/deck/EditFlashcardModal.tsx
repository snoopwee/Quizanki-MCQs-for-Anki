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
        <p className="text-xs text-neutral-500">{note.noteType}</p>

        {note.cloze && (
          <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            This is a cloze card. Keep the <code>{"{{c1::answer}}"}</code> markers
            intact — each one becomes a separate question.
          </p>
        )}

        {canSwap && (
          <button
            type="button"
            onClick={handleSwap}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
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
              className="nice-scroll w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        ))}

        {updateNote.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t save your changes. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={updateNote.isPending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateNote.isPending || !dirty}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {updateNote.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
