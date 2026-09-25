"use client";

import { useState } from "react";
import { DeckGrid } from "@/components/home/DeckGrid";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { deckCountLabel, folderErrorMessage, normalizeFolderName } from "@/lib/folderDisplay";
import {
  useCreateFolder,
  useDeleteFolder,
  useFolder,
  useFolders,
  useRenameFolder,
} from "@/hooks/useFolders";

// Home's Folders tab. Two views in one: the folder list, and one folder's decks — which render
// through the same DeckGrid as every other tab, so a folder isn't a second kind of deck list.
export function FoldersTab() {
  const [openId, setOpenId] = useState<string | null>(null);

  return openId ? (
    <OpenFolder folderId={openId} onBack={() => setOpenId(null)} />
  ) : (
    <FolderList onOpen={setOpenId} />
  );
}

function FolderList({ onOpen }: { onOpen: (folderId: string) => void }) {
  const folders = useFolders();
  const create = useCreateFolder();
  const [newName, setNewName] = useState("");

  function submit() {
    const name = normalizeFolderName(newName);
    if (!name || create.isPending) return;
    create.mutate(name, { onSuccess: () => setNewName("") });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={60}
          placeholder="New folder name"
          aria-label="New folder name"
          className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface px-3 py-2 text-sm text-ink sm:max-w-xs"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!newName.trim() || create.isPending}
          className={buttonClasses({ variant: "soft", size: "sm" })}
        >
          {create.isPending ? <Spinner className="h-4 w-4 text-accent" label="Creating" /> : <Icon name="plus" size={15} />}
          New folder
        </button>
      </div>

      {create.isError && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <Icon name="alertTriangle" size={14} />
          {/* 409 when the name is taken — the backend's message names it. */}
          {folderErrorMessage(create.error, "Couldn't create that folder.")}
        </p>
      )}

      {folders.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : folders.isError ? (
        <p className="text-sm text-danger">Could not load folders.</p>
      ) : (folders.data ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
            <Icon name="folder" size={24} />
          </span>
          <p className="text-sm font-medium text-ink">No folders yet.</p>
          <p className="max-w-xs text-sm text-muted">
            Group decks however you like — by subject, by exam, by textbook. A deck can sit in
            several folders.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(folders.data ?? []).map((folder) => (
            <li key={folder.id}>
              <FolderCard
                id={folder.id}
                name={folder.name}
                deckCount={folder.deckCount}
                onOpen={() => onOpen(folder.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FolderCard({
  id,
  name,
  deckCount,
  onOpen,
}: {
  id: string;
  name: string;
  deckCount: number;
  onOpen: () => void;
}) {
  const rename = useRenameFolder();
  const remove = useDeleteFolder();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  // Deleting is two-step in place rather than a modal: the consequence is small (decks stay) and
  // a dialog for "are you sure" on something reversible is more ceremony than it earns.
  const [confirming, setConfirming] = useState(false);

  function saveName() {
    const next = normalizeFolderName(draftName);
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    rename.mutate({ folderId: id, name: next }, { onSuccess: () => setEditing(false) });
  }

  return (
    <Card className="p-4">
      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={60}
            aria-label="Folder name"
            className="focus-ring w-full rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={saveName}
              disabled={rename.isPending}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              Save
            </button>
          </div>
          {rename.isError && (
            <p className="text-xs text-danger">{folderErrorMessage(rename.error, "Couldn't rename it.")}</p>
          )}
        </div>
      ) : confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Delete “{name}”?</p>
          <p className="text-xs text-muted">The decks inside it stay in your library.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => remove.mutate(id)}
              disabled={remove.isPending}
              className={buttonClasses({ variant: "danger", size: "sm" })}
            >
              {remove.isPending && <Spinner className="h-3.5 w-3.5 text-danger" label="Deleting" />}
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpen} className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent">
              <Icon name="folder" size={20} />
            </span>
            <span className="min-w-0">
              <span title={name} className="block truncate font-display text-[0.9375rem] font-semibold text-ink">
                {name}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-faint">
                {deckCountLabel(deckCount)}
              </span>
            </span>
          </button>
          <KebabMenu
            label={`${name} options`}
            items={[
              { label: "Rename", icon: "pencil", onClick: () => { setDraftName(name); setEditing(true); } },
              { label: "Delete", icon: "trash", danger: true, onClick: () => setConfirming(true) },
            ]}
          />
        </div>
      )}
    </Card>
  );
}

function OpenFolder({ folderId, onBack }: { folderId: string; onBack: () => void }) {
  const folder = useFolder(folderId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <Icon name="chevronLeft" size={15} />
          All folders
        </button>
        <h2 className="min-w-0 truncate font-display text-lg font-bold tracking-tight text-ink">
          {folder.data?.name ?? "…"}
        </h2>
      </div>

      <DeckGrid
        query={{ data: folder.data?.decks, isLoading: folder.isLoading, isError: folder.isError }}
        showAuthor
        emptyTitle="This folder is empty."
        emptyHint="Open a deck and use its ⋯ menu to file it here."
      />
    </div>
  );
}
