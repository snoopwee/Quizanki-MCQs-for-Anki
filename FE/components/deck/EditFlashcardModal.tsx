"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/shared/Modal";
import { fieldLabel } from "@/lib/deckEditor";
import { useUpdateNote } from "@/hooks/useNotes";
import { TTS_LANGUAGE_OPTIONS } from "@/lib/ttsLanguages";
import { CardImageSlot } from "@/components/deck/CardImageSlot";
import { CardAudioSlot } from "@/components/deck/CardAudioSlot";

export interface EditableNote {
  noteId: string;
  noteType: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  // Fields folded into the per-side media slots (empty [sound:]/<img> holders) — not
  // shown as text boxes, matching the deck editor. Off/unticked fields (on neither
  // side) are hidden too. Both keep their stored value; only the UI omits them.
  hiddenFields?: string[];
  fields: Record<string, string>;
  // Per-face TTS language override (BCP-47 primary subtag), or null to inherit
  // the deck default. Edited via the per-field "voice" selects below.
  frontLang: string | null;
  backLang: string | null;
  // Per-face card image URL, or null when the side has no image.
  frontImageUrl: string | null;
  backImageUrl: string | null;
  // Per-face card audio URL, or null when the side has no audio.
  frontAudioUrl: string | null;
  backAudioUrl: string | null;
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
  // Per-face audio URL ("" = no audio).
  const [audFront, setAudFront] = useState(note.frontAudioUrl ?? "");
  const [audBack, setAudBack] = useState(note.backAudioUrl ?? "");

  const fieldsDirty = note.fieldNames.some((f) => (note.fields[f] ?? "") !== values[f]);
  const langDirty = langFront !== (note.frontLang ?? "") || langBack !== (note.backLang ?? "");
  const imgDirty = imgFront !== (note.frontImageUrl ?? "") || imgBack !== (note.backImageUrl ?? "");
  const audDirty = audFront !== (note.frontAudioUrl ?? "") || audBack !== (note.backAudioUrl ?? "");
  const dirty = fieldsDirty || langDirty || imgDirty || audDirty;

  const folded = new Set(note.hiddenFields ?? []);
  // Non-cloze cards render Term + Definition groups showing only the fields actually
  // on the card (folded media holders + off/unticked fields omitted). Cloze /
  // layout-less notes fall back to a flat list of their (non-folded) fields.
  const visibleFront = note.frontFields.filter((f) => !folded.has(f));
  const visibleBack = note.backFields.filter((f) => !folded.has(f));
  const hasSides = !note.cloze && (visibleFront.length > 0 || visibleBack.length > 0);
  const flatFields = note.cloze
    ? note.fieldNames
    : note.fieldNames.filter((f) => !folded.has(f));
  // The flat fallback keeps the old per-field voice placement (term on the first
  // field, definition on the second).
  const flatTerm = flatFields[0];
  const flatDef = flatFields.find((f) => f !== flatTerm) ?? flatTerm;

  // Swap exchanges the primary visible term / definition field values.
  const frontField = visibleFront[0];
  const backField = visibleBack[0];
  const canSwap =
    !note.cloze && Boolean(frontField) && Boolean(backField) && frontField !== backField;

  const setField = (field: string, value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  function handleSwap() {
    if (!canSwap || !frontField || !backField) return;
    setValues((v) => ({
      ...v,
      [frontField]: v[backField] ?? "",
      [backField]: v[frontField] ?? "",
    }));
    // The languages, images and audio follow their text to the other side.
    setLangFront(langBack);
    setLangBack(langFront);
    setImgFront(imgBack);
    setImgBack(imgFront);
    setAudFront(audBack);
    setAudBack(audFront);
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
        frontAudioUrl: audFront,
        backAudioUrl: audBack,
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

        {hasSides ? (
          <>
            <FieldSide
              label="Term"
              voice={<LangSelect label="Term voice" value={langFront} onChange={setLangFront} />}
              fields={visibleFront}
              values={values}
              onField={setField}
              imageUrl={imgFront}
              onImage={setImgFront}
              audioUrl={audFront}
              onAudio={setAudFront}
            />
            <FieldSide
              label="Definition"
              voice={<LangSelect label="Definition voice" value={langBack} onChange={setLangBack} />}
              fields={visibleBack}
              values={values}
              onField={setField}
              imageUrl={imgBack}
              onImage={setImgBack}
              audioUrl={audBack}
              onAudio={setAudBack}
            />
          </>
        ) : (
          flatFields.map((field) => {
            const showTerm = field === flatTerm;
            const showDef = field === flatDef;
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
                  onChange={(e) => setField(field, e.target.value)}
                  rows={note.cloze ? 4 : 2}
                  className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
                />
                {(showTerm || showDef) && (
                  <CardImageSlot
                    url={showTerm ? imgFront : imgBack}
                    onChange={showTerm ? setImgFront : setImgBack}
                  />
                )}
                {(showTerm || showDef) && (
                  <CardAudioSlot
                    url={showTerm ? audFront : audBack}
                    onChange={showTerm ? setAudFront : setAudBack}
                  />
                )}
              </div>
            );
          })
        )}

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

// One side of the card (Term or Definition): a header with the side's voice picker,
// a textarea per field on that side, then the side's image + audio slots. A side
// with no visible text field (e.g. an audio-only term) still shows its media slots.
function FieldSide({
  label,
  voice,
  fields,
  values,
  onField,
  imageUrl,
  onImage,
  audioUrl,
  onAudio,
}: {
  label: string;
  voice: ReactNode;
  fields: string[];
  values: Record<string, string>;
  onField: (field: string, value: string) => void;
  imageUrl: string;
  onImage: (url: string) => void;
  audioUrl: string;
  onAudio: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {voice}
      </div>
      {fields.map((field) => (
        <div key={field} className="space-y-1">
          {fields.length > 1 && (
            <span className="font-mono text-xs font-medium text-muted">{fieldLabel(field)}</span>
          )}
          <textarea
            value={values[field] ?? ""}
            onChange={(e) => onField(field, e.target.value)}
            rows={2}
            className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
          />
        </div>
      ))}
      <CardImageSlot url={imageUrl} onChange={onImage} />
      <CardAudioSlot url={audioUrl} onChange={onAudio} />
    </div>
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
