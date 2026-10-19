"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DeckGrid } from "@/components/home/DeckGrid";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { deckCountLabel, isMissingFolderError } from "@/lib/folderDisplay";
import { useFolder } from "@/hooks/useFolders";

/**
 * One folder's decks, at its own URL.
 *
 * <p>The decks render through the same {@link DeckGrid} as every Home tab, so a folder is not a
 * second kind of deck list — it is the same list, filtered.
 *
 * <p>A missing folder gets its own answer rather than the generic error. Now that a folder has a
 * URL, 404 is an ordinary outcome: bookmark one, delete it, come back. The backend also answers 404
 * (not 403) for somebody else's folder, which keeps this page from confirming that one exists.
 */
export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const folder = useFolder(folderId);
  const deckCount = folder.data?.decks.length;

  if (folder.isError && isMissingFolderError(folder.error)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-input bg-surface-2 text-muted">
            <Icon name="folder" size={24} />
          </span>
          <p className="text-sm font-medium text-ink">That folder isn’t there any more.</p>
          <p className="max-w-xs text-sm text-muted">
            It may have been deleted. Your decks are unaffected — deleting a folder never touches
            what was inside it.
          </p>
          <Link href="/folders" className={buttonClasses({ variant: "soft", size: "sm" })}>
            All folders
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/folders" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <Icon name="chevronLeft" size={15} />
          All folders
        </Link>
        <div className="mt-3 flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-input bg-accent-soft text-accent">
            <Icon name="folder" size={22} />
          </span>
          <div className="min-w-0">
            {/* The name arrives with the decks, so hold the row's height with a placeholder
                rather than letting the heading pop in and shove the grid down. */}
            <h1
              title={folder.data?.name}
              className="truncate font-display text-2xl font-bold tracking-tight text-ink"
            >
              {folder.data?.name ?? (
                <span aria-hidden className="inline-block h-6 w-40 animate-pulse rounded bg-surface-2" />
              )}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-faint">
              {deckCount === undefined ? " " : deckCountLabel(deckCount)}
            </p>
          </div>
        </div>
      </div>

      <DeckGrid
        query={{ data: folder.data?.decks, isLoading: folder.isLoading, isError: folder.isError }}
        showAuthor
        emptyTitle="This folder is empty."
        emptyHint="Open a deck and use its ⋯ menu to file it here."
        emptyAction={
          <Link href="/home" className={buttonClasses({ variant: "soft", size: "sm" })}>
            Pick a deck to file
          </Link>
        }
      />
    </div>
  );
}
