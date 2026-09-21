"use client";

import { useState, type ReactNode } from "react";
import { canSwapRow, fieldLabel, groupFields, type EditorRow } from "@/lib/deckEditor";
import { TTS_LANGUAGE_OPTIONS } from "@/lib/ttsLanguages";
import { CardImageSlot } from "@/components/deck/CardImageSlot";
import { CardAudioSlot } from "@/components/deck/CardAudioSlot";
import { CardAudioPlayButton } from "@/components/deck/CardAudioPlayButton";
import { Icon } from "@/components/ui/icons";

// One card's editable body, shared by the saved-deck editor
// (app/(app)/decks/[deckId]/edit), the pre-save import review screen, and the
// create-from-scratch flow, so the three feel like the same tool. Each page keeps
// its own list/toolbar around it — only the saved-deck editor has note ids, layout
// swaps and drag reorder.
//
// Layout: Term and Definition sit side by side as two columns, and EACH column
// carries its own text field(s) plus its own media (image + audio) directly beneath
// them — so a picture/clip visibly belongs to that side. Unrelated ("Other") fields
// span full width below; cloze / no-sided cards fall back to a single flat column.
// Focusing a field reveals a "voice" (TTS language) menu for that side.

export interface EditableCardProps {
  row: EditorRow;
  index: number;
  onField: (key: string, field: string, value: string) => void;
  onSwap: (key: string) => void;
  onDelete: (key: string) => void;
  onLang: (key: string, face: "front" | "back", code: string) => void;
  // Set a face's image URL ("" clears it). When omitted, the image UI is hidden.
  onImage?: (key: string, face: "front" | "back", url: string) => void;
  // Set a face's audio URL ("" clears it). Hidden when omitted, same as onImage.
  onAudio?: (key: string, face: "front" | "back", url: string) => void;
  // Read-only audio playback for a face (import review): the face's clip filename
  // plus a resolver that produces a playable URL on demand (from the kept .apkg).
  // Shows a Play button — distinct from the upload slot (onAudio).
  playAudio?: {
    front: string | null;
    back: string | null;
    resolve: (filename: string) => Promise<string | null>;
  };
  // Field names whose textarea to hide — pure media holders / unused fields that
  // are empty across the whole note type (see emptyFieldsByType). Purely visual.
  hiddenFields?: Set<string>;
}

export function EditableCard({ row, index, onField, onSwap, onDelete, onLang, onImage, onAudio, playAudio, hiddenFields }: EditableCardProps) {
  const [activeField, setActiveField] = useState<string | null>(null);

  const visible = row.fieldNames.filter((f) => !hiddenFields?.has(f));
  // A field shows only on the side it belongs to (Term / Definition). Anything not
  // on either side isn't rendered on the card — extras join the definition via the
  // "Fields shown on cards" control, which moves them onto the back side.
  const { term, definition } = groupFields(visible, row.frontFields, row.backFields);
  // When the note type has no front/back layout (e.g. cloze), there's no term /
  // definition split — render the fields flat instead of two columns.
  const hasSides = term.length > 0 || definition.length > 0;
  const hasMedia = Boolean(onImage || onAudio || playAudio);

  const fieldTextarea = (field: string, showName: boolean) => (
    <div key={field} className="space-y-1">
      {showName && (
        <span className="font-mono text-xs font-medium text-muted">{fieldLabel(field)}</span>
      )}
      <textarea
        value={row.fields[field] ?? ""}
        onFocus={() => setActiveField(field)}
        onChange={(e) => onField(row.key, field, e.target.value)}
        rows={row.cloze ? 3 : 2}
        className="nice-scroll focus-ring w-full cursor-text select-text resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none"
      />
    </div>
  );

  // The image + audio controls for one face. Upload slots when the page passes the
  // setters; otherwise the review-only Play button (clip not uploaded yet). Hidden
  // entirely when the page wires no media at all.
  const faceMedia = (face: "front" | "back") => {
    if (!hasMedia) return null;
    const imageUrl = face === "front" ? row.frontImageUrl : row.backImageUrl;
    const audioUrl = face === "front" ? row.frontAudioUrl : row.backAudioUrl;
    const playRef = playAudio ? playAudio[face] : null;
    return (
      <div className="space-y-2 border-t border-line pt-2.5">
        {onImage && (
          <CardImageSlot url={imageUrl} onChange={(url) => onImage(row.key, face, url)} />
        )}
        {/* An imported .apkg clip previews with a read-only Play button; otherwise
            (paste / create-from-scratch, or a face with no imported clip) the upload
            slot, when the page allows audio upload. */}
        {playRef && playAudio ? (
          <CardAudioPlayButton resolve={() => playAudio.resolve(playRef)} />
        ) : onAudio ? (
          <CardAudioSlot url={audioUrl} onChange={(url) => onAudio(row.key, face, url)} />
        ) : null}
      </div>
    );
  };

  // One side as a column: header (label + voice picker, revealed on focus or when
  // set), the side's text field(s), then that side's media. A single-field side
  // needs no per-field name — the header already says which side it is.
  const sideColumn = (label: string, fields: string[], face: "front" | "back") => {
    const showFieldNames = fields.length > 1;
    const voiceShown =
      (activeField !== null && fields.includes(activeField)) ||
      (face === "front" && row.frontLang !== "") ||
      (face === "back" && row.backLang !== "");
    return (
      <div className="space-y-1.5 rounded-input border border-line bg-surface-2/40 p-3">
        <div className="flex min-h-[1.25rem] items-center justify-between gap-2">
          <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">
            {label}
          </span>
          {voiceShown && (
            <LangSelect
              label={face === "front" ? "Term voice" : "Definition voice"}
              value={face === "front" ? row.frontLang : row.backLang}
              onChange={(code) => onLang(row.key, face, code)}
            />
          )}
        </div>
        {fields.map((field) => fieldTextarea(field, showFieldNames))}
        {faceMedia(face)}
      </div>
    );
  };

  // "Other" (non-front/back) fields, or the flat fallback for cloze/no-sided cards.
  // These have no side, so no per-side media.
  const flatGroup = (label: string, fields: string[]) => {
    if (fields.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {label !== "" && (
          <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">
            {label}
          </span>
        )}
        {fields.map((field) => fieldTextarea(field, true))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 font-mono text-xs text-faint">
        <span>#{index + 1}</span>
        {row.cloze && (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">
            Cloze
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {canSwapRow(row) && (
            <IconBtn label="Swap front/back" onClick={() => onSwap(row.key)}>
              <Icon name="swap" size={15} />
            </IconBtn>
          )}
          <IconBtn label="Delete card" danger onClick={() => onDelete(row.key)}>
            <Icon name="x" size={15} />
          </IconBtn>
        </div>
      </div>

      <div
        className="space-y-3"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveField(null);
        }}
      >
        {hasSides ? (
          <>
            {/* Term | Definition side by side, each with its own text + media. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {sideColumn("Term", term, "front")}
              {sideColumn("Definition", definition, "back")}
            </div>
          </>
        ) : (
          <>
            {flatGroup("", visible)}
            {/* Cloze / no-sided cards still get their media, as a two-up row. */}
            {hasMedia && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted">Term</span>
                  {faceMedia("front")}
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted">Definition</span>
                  {faceMedia("back")}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Compact per-face TTS-language picker shown on a side's header row. "" is
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
      className={`inline-flex cursor-pointer items-center justify-center rounded px-1.5 py-1 text-sm transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-30 ${
        danger ? "text-danger" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
