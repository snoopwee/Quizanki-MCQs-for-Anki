"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminDecks, useAdminDeleteDeck, useAdminUnpublishDeck } from "@/hooks/useAdmin";
import type { PublicDeckSummary } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

const PAGE_SIZE = 20;

// Moderate decks: every public deck, with the two moderation actions — Unpublish
// (off Discover, owner keeps it) and Delete (gone, cascades). Read-through to the
// deck page ("View") so an admin can inspect content before acting.
export default function AdminDecksPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const decks = useAdminDecks({ q, page, pageSize: PAGE_SIZE });
  const [toDelete, setToDelete] = useState<PublicDeckSummary | null>(null);

  const unpublish = useAdminUnpublishDeck();
  const del = useAdminDeleteDeck();

  const result = decks.data;
  const items = result?.items ?? [];

  function search(next: string) {
    setQ(next);
    setPage(0);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Moderate decks</h1>
        <p className="mt-1 text-sm text-muted">
          Every public deck. Unpublish to pull one from Discover (the owner keeps it), or delete it
          entirely for spam or abuse.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search decks…"
          className="focus-ring w-full max-w-xs rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-faint"
        />
        {result && (
          <span className="shrink-0 font-mono text-xs text-muted">
            {result.total} deck{result.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {decks.isLoading ? (
        <SkeletonList />
      ) : decks.isError ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          Couldn&apos;t load decks. Try again.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
          {q ? `No public decks match “${q}”.` : "No public decks yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((deck) => (
            <li key={deck.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{deck.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {deck.authorName ?? "Unknown author"} · {deck.cardCount ?? 0} card
                  {deck.cardCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/decks/${deck.id}`}
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="eye" size={14} /> View
                </Link>
                <button
                  type="button"
                  onClick={() => unpublish.mutate(deck.id)}
                  disabled={unpublish.isPending}
                  className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(deck)}
                  className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 font-medium text-muted transition hover:text-ink disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono text-xs text-muted">
            Page {page + 1} of {result.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(result.totalPages - 1, p + 1))}
            disabled={page >= result.totalPages - 1}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 font-medium text-muted transition hover:text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {toDelete && (
        <Modal title="Delete this deck?" onClose={del.isPending ? () => {} : () => setToDelete(null)}>
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{toDelete.name}</span> will be permanently deleted,
            along with its cards and everyone&apos;s progress on it. This can&apos;t be undone.
          </p>
          <p className="mt-2 text-xs text-faint">
            To just take it off Discover, use Unpublish instead — the owner keeps the deck.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={del.isPending}
              className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
              }
              disabled={del.isPending}
              className="inline-flex items-center gap-2 rounded-input bg-danger px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
            >
              {del.isPending && <Spinner className="h-4 w-4" />}
              Delete deck
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="h-8 w-40 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
