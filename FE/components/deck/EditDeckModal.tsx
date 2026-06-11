"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { useRenameDeck } from "@/hooks/useDecks";

// Deck-level edit. For now the only editable property is the name (rename);
// export and other deck management land in later passes behind the same menu.
export function EditDeckModal({
  deckId,
  currentName,
  onClose,
}: {
  deckId: string;
  currentName: string;
  onClose: () => void;
}) {
  const renameDeck = useRenameDeck();
  const [name, setName] = useState(currentName);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName;

  function handleSave() {
    renameDeck.mutate({ deckId, name: trimmed }, { onSuccess: onClose });
  }

  return (
    <Modal title="Rename deck" onClose={onClose}>
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Deck name</span>
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) handleSave();
            }}
            className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
          />
        </label>

        {renameDeck.isError && (
          <p className="text-sm text-danger">
            Couldn&apos;t rename the deck. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={renameDeck.isPending}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={renameDeck.isPending || !canSave}
            className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
          >
            {renameDeck.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
