"use client";

import { useState } from "react";
import Link from "next/link";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { deckCountLabel, folderErrorMessage, normalizeFolderName } from "@/lib/folderDisplay";
import { folderHref } from "@/lib/folderNav";
import { useCreateFolder, useDeleteFolder, useFolders, useRenameFolder } from "@/hooks/useFolders";

/**
 * The folder list, plus creating, renaming and deleting one.
 *
 * <p>Lives here rather than inside Home's tab because folders are reachable from three places now
 * — the sidebar, `/folders`, and Home — and a second copy of this would drift from the first.
 *
 * <p>Opening a folder is a **link**, not component state. It used to be state, which meant a folder
 * had no URL: you couldn't bookmark one, send one to yourself, or press Back to get out of it.
 */
export function FolderList() {
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
          {create.isPending ? (
            <Spinner className="h-4 w-4 text-accent" label="Creating" />
          ) : (
            <Icon name="plus" size={15} />
          )}
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
        <FolderListSkeleton />
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
              <FolderCard id={folder.id} name={folder.name} deckCount={folder.deckCount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Folder cards are a fixed, small height, so a skeleton that matches them is honest about what is
// coming — better than a bare "Loading…", which gives the layout no hint and jumps when it lands.
function FolderListSkeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i}>
          <Card className="flex items-center gap-3 p-4">
            <span className="h-10 w-10 shrink-0 animate-pulse rounded-input bg-surface-2" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-2/3 animate-pulse rounded bg-surface-2" />
              <span className="block h-2.5 w-16 animate-pulse rounded bg-surface-2" />
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function FolderCard({ id, name, deckCount }: { id: string; name: string; deckCount: number }) {
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
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
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
            <p className="text-xs text-danger">
              {folderErrorMessage(rename.error, "Couldn't rename it.")}
            </p>
          )}
        </div>
      ) : confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Delete “{name}”?</p>
          <p className="text-xs text-muted">The decks inside it stay in your library.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
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
          <Link
            href={folderHref(id)}
            className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent">
              <Icon name="folder" size={20} />
            </span>
            <span className="min-w-0">
              <span
                title={name}
                className="block truncate font-display text-[0.9375rem] font-semibold text-ink"
              >
                {name}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-faint">
                {deckCountLabel(deckCount)}
              </span>
            </span>
          </Link>
          <KebabMenu
            label={`${name} options`}
            items={[
              {
                label: "Rename",
                icon: "pencil",
                onClick: () => {
                  setDraftName(name);
                  setEditing(true);
                },
              },
              { label: "Delete", icon: "trash", danger: true, onClick: () => setConfirming(true) },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
