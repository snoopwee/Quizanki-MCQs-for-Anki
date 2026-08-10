"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { fieldLabel } from "@/lib/deckEditor";
import { useUpdateNote } from "@/hooks/useNotes";
import { TTS_LANGUAGE_OPTIONS } from "@/lib/ttsLanguages";
import { CardImageSlot } from "@/components/deck/CardImageSlot";

export interface EditableNote {
  noteId: string;
  noteType: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  fields: Record<string, string>;
  // Per-face TTS language override (BCP-47 primary subtag), or null to inherit
  // the deck default. Edited via the per-field "voice" selects below.
  frontLang: string | null;
  backLang: string | null;
  // Per-face card image URL, or null when the side has no image.
  frontImageUrl: string | null;
  backImageUrl: string | null;
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
  // Per-face TTS language override ("" = inherit the deck default / auto).
  const [langFront, setLangFront] = useState(note.frontLang ?? "");
  const [langBack, setLangBack] = useState(note.backLang ?? "");
  // Per-face image URL ("" = no image).
  const [imgFront, setImgFront] = useState(note.frontImageUrl ?? "");
  const [imgBack, setImgBack] = useState(note.backImageUrl ?? "");

  const fieldsDirty = note.fieldNames.some((f) => (note.fields[f] ?? "") !== values[f]);
  const langDirty = langFront !== (note.frontLang ?? "") || langBack !== (note.backLang ?? "");
  const imgDirty = imgFront !== (note.frontImageUrl ?? "") || imgBack !== (note.backImageUrl ?? "");
  const dirty = fieldsDirty || langDirty || imgDirty;

  const frontField = note.frontFields[0];
  const backField = note.backFields[0];
  const canSwap =
    !note.cloze && Boolean(frontField) && Boolean(backField) && frontField !== backField;

  // Which field row carries the term (front) vs definition (back) language select.
  // Falls back so both are always settable even for single-field / cloze notes.
  const termField = frontField ?? note.fieldNames[0];
  const defField =
    backField ?? note.fieldNames.find((f) => f !== termField) ?? termField;

  function handleSwap() {
    if (!canSwap) return;
    setValues((v) => ({
      ...v,
      [frontField]: v[backField] ?? "",
      [backField]: v[frontField] ?? "",
    }));
    // The languages and images follow their text to the other side.
    setLangFront(langBack);
    setLangBack(langFront);
    setImgFront(imgBack);
    setImgBack(imgFront);
  }

  function handleSave() {
    updateNote.mutate(
      {
        noteId: note.noteId,
        fields: values,
        frontLang: langFront,
        backLang: langBack,
        frontImageUrl: imgFront,
        backImageUrl: imgBack,
      },
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

        {note.fieldNames.map((field) => {
          // Term select on the front field's row, definition select on the back
          // field's row; both land on the same row for single-field / cloze notes.
          const showTerm = field === termField;
          const showDef = field === defField;
          return (
            <div key={field} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{fieldLabel(field)}</span>
                <div className="flex items-center gap-2">
                  {showTerm && (
                    <LangSelect label="Term voice" value={langFront} onChange={setLangFront} />
                  )}
                  {showDef && (
                    <LangSelect label="Definition voice" value={langBack} onChange={setLangBack} />
                  )}
                </div>
              </div>
              <textarea
                value={values[field]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field]: e.target.value }))
                }
                rows={field.toLowerCase().includes("back") || note.cloze ? 4 : 2}
                className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
              />
              {/* Per-face image (term face → front, definition → back). */}
              {(showTerm || showDef) && (
                <CardImageSlot
                  url={showTerm ? imgFront : imgBack}
                  onChange={showTerm ? setImgFront : setImgBack}
                />
              )}
            </div>
          );
        })}

        {updateNote.isError && (
          <p className="text-sm text-danger">
            Couldn&apos;t save your changes. Please try again.
          </p>
        )}

        <p className="text-xs text-muted">
          &ldquo;Voice&rdquo; sets the text-to-speech language for that side. Leave on Auto-detect
          unless it&apos;s read in the wrong language (e.g. kanji read as Chinese).
        </p>

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
        className="focus-ring rounded border border-line-strong bg-surface px-1.5 py-1 text-xs text-ink outline-none"
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
