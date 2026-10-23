"use client";

import Link from "next/link";
import { FolderList } from "@/components/folders/FolderList";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";

/**
 * Folders, as a place rather than a tab.
 *
 * <p>They were only reachable from Home's fourth tab and a deck's ⋯ dialog, which is how a feature
 * that is already built goes unused. Quizlet and Knowt both keep folders in the rail; this is the
 * page that link lands on.
 */
export default function FoldersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Folders</h1>
          <p className="mt-1 text-sm text-muted">
            Group decks by subject, exam or textbook. A deck can sit in several folders at once.
          </p>
        </div>
        <Link href="/home" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <Icon name="layers" size={16} /> All your decks
        </Link>
      </div>

      <FolderList />
    </div>
  );
}
