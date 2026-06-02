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
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {renameDeck.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t rename the deck. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={renameDeck.isPending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={renameDeck.isPending || !canSave}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {renameDeck.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
