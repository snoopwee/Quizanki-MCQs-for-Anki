"use client";

import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/ui/controls";
import { fieldLabel, groupFields } from "@/lib/deckEditor";

// A note type as the modal needs it: its fields plus the front/back layout so it
// can group them into Term / Definition / Other. `name` is shown only when a deck
// has more than one note type.
export interface FieldModalNoteType {
  id: string;
  name?: string;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
}

// "Fields shown while editing" — toggles which fields appear in the editor. This is
// a view preference only: nothing is deleted, and a hidden field's data still saves
// and can be turned back on. Fields are grouped by the side they sit on so it's
// clear which belong to the term vs the definition, with unrelated fields apart.
export function FieldVisibilityModal({
  noteTypes,
  isVisible,
  onToggle,
  onClose,
}: {
  noteTypes: FieldModalNoteType[];
  isVisible: (typeId: string, field: string) => boolean;
  onToggle: (typeId: string, field: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Fields shown while editing" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs leading-relaxed text-muted">
          Choose which fields show while you edit. This only changes your view — nothing is
          deleted, a hidden field still saves, and you can turn it back on anytime.
        </p>

        {noteTypes.map((nt, i) => {
          const { term, definition, other } = groupFields(nt.fieldNames, nt.frontFields, nt.backFields);
          return (
            <div key={nt.id} className="space-y-3">
              {noteTypes.length > 1 && (
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">
                  {nt.name || `Card type ${i + 1}`}
                </h3>
              )}
              <FieldGroupToggles label="Term" fields={term} typeId={nt.id} isVisible={isVisible} onToggle={onToggle} />
              <FieldGroupToggles label="Definition" fields={definition} typeId={nt.id} isVisible={isVisible} onToggle={onToggle} />
              <FieldGroupToggles label="Other fields" fields={other} typeId={nt.id} isVisible={isVisible} onToggle={onToggle} />
            </div>
          );
        })}

        <div className="flex justify-end border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-input bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FieldGroupToggles({
  label,
  fields,
  typeId,
  isVisible,
  onToggle,
}: {
  label: string;
  fields: string[];
  typeId: string;
  isVisible: (typeId: string, field: string) => boolean;
  onToggle: (typeId: string, field: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <div className="space-y-1.5">
        {fields.map((field) => (
          <label
            key={field}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-input border border-line bg-surface px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{fieldLabel(field)}</span>
            <Toggle on={isVisible(typeId, field)} onChange={() => onToggle(typeId, field)} />
          </label>
        ))}
      </div>
    </div>
  );
}
