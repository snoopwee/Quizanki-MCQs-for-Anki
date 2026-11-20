"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useCreateFolder, useFileDeck, useFolders } from "@/hooks/useFolders";
import { folderErrorMessage, normalizeFolderName } from "@/lib/folderDisplay";
import { useT } from "@/components/i18n/LocaleProvider";

// Files one deck into the viewer's own folders. Folders are private grouping, so this works on a
// deck you merely saved too, and filing changes nothing for its owner. Each tick is saved as it is
// clicked — there is no Save button to forget.
export function AddToFolderModal({
  deckId,
  deckName,
  onClose,
}: {
  deckId: string;
  deckName: string | null;
  onClose: () => void;
}) {
  // Asking with the deck id gets the ticked state for every folder in one request.
  const folders = useFolders(deckId);
  const file = useFileDeck();
  const create = useCreateFolder();
  const [newName, setNewName] = useState("");

  function createAndFile() {
    const name = normalizeFolderName(newName);
    if (!name || create.isPending) return;
    create.mutate(name, {
      onSuccess: (folder) => {
        setNewName("");
        file.mutate({ folderId: folder.id, deckId, filed: true });
      },
    });
  }

  const t = useT();
  const list = folders.data ?? [];

  return (
    <Modal title={t("folderModal.title")} onClose={onClose}>
      <p className="text-sm text-muted">
        {t("folderModal.explain", { name: deckName || t("folderModal.thisDeck") })}
      </p>

      <div className="mt-4 space-y-3">
        {folders.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4 text-accent" /> {t("folderModal.loading")}
          </p>
        ) : folders.isError ? (
          <p className="text-sm text-danger">{t("folderModal.loadFailed")}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted">{t("folderModal.none")}</p>
        ) : (
          <ul className="nice-scroll max-h-64 space-y-1 overflow-y-auto">
            {list.map((folder) => {
              const busy =
                file.isPending && file.variables?.folderId === folder.id;
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={folder.containsDeck}
                    disabled={busy}
                    onClick={() =>
                      file.mutate({ folderId: folder.id, deckId, filed: !folder.containsDeck })
                    }
                    className="focus-ring flex w-full items-center gap-3 rounded-input px-2.5 py-2 text-left transition hover:bg-surface-2 disabled:cursor-wait"
                  >
                    {/* Our own box rather than a native checkbox: the OS paints that one and it
                        breaks the palette. */}
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[0.3rem] border transition ${
                        folder.containsDeck
                          ? "border-accent bg-accent text-white"
                          : "border-line-strong text-transparent"
                      }`}
                    >
                      {busy ? (
                        <Spinner className="h-3 w-3 text-accent" label={t("folderModal.saving")} />
                      ) : (
                        <Icon name="check" size={13} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{folder.name}</span>
                    <span className="shrink-0 font-mono text-xs text-faint">
                      {t("deck.count", { count: folder.deckCount })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {file.isError && <p className="text-sm text-danger">{t("folderModal.saveFailed")}</p>}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndFile();
              }
            }}
            maxLength={60}
            placeholder={t("folderModal.newName")}
            aria-label={t("folderModal.newName")}
            className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-faint"
          />
          <button
            type="button"
            onClick={createAndFile}
            disabled={!newName.trim() || create.isPending}
            className={buttonClasses({ variant: "soft", size: "sm" })}
          >
            {create.isPending ? (
              <Spinner className="h-4 w-4 text-accent" label={t("folderModal.creating")} />
            ) : (
              <Icon name="plus" size={15} />
            )}
            {t("folderModal.createAndAdd")}
          </button>
        </div>
        {create.isError && (
          <p className="text-sm text-danger">
            {/* 409 when they already have a folder by that name — the backend names it. */}
            {folderErrorMessage(
              create.error,
              t("folderModal.createFailed"),
              t("common.offline"),
            )}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: "primary", size: "md" })}>
          {t("common.done")}
        </button>
      </div>
    </Modal>
  );
}
