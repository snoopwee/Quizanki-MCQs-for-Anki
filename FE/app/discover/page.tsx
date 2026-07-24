"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDiscoverDecks } from "@/hooks/useDecks";
import { AppChrome } from "@/components/layout/AppChrome";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { SIZE_FILTERS, sizeFilterById } from "@/lib/discoverFilters";

// Every deck people have chosen to publish. Open to everyone — a guest browses
// exactly what a member does; copying a deck is the part that needs an account,
// and that lives on the deck's own /shared/{id} page.
//
// Outside the (app) route group on purpose (guests must reach it); AppChrome adds
// the sidebar for signed-in users so it still feels like part of the app.

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 12;

export default function DiscoverPage() {
  return (
    <AppChrome>
      <DiscoverContent />
    </AppChrome>
  );
}

function DiscoverContent() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sizeId, setSizeId] = useState("all");
  const [page, setPage] = useState(0); // zero-based

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Any change to what's being asked for resets to the first page — otherwise a
  // filter could land you on a page that no longer exists.
  useEffect(() => setPage(0), [query, sizeId]);

  const size = sizeFilterById(sizeId);
  const params = useMemo(
    () => ({ q: query, minCards: size.min, maxCards: size.max, page, pageSize: PAGE_SIZE }),
    [query, size.min, size.max, page],
  );

  const decksQuery = useDiscoverDecks(params);
  const result = decksQuery.data;
  const decks = result?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Discover decks</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Decks people have shared. Open one to preview it, then save your own copy — you get your
          own cards and your own progress.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-md">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          >
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Search shared decks"
            placeholder="Search shared decks…"
            className="focus-ring w-full rounded-input border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint"
          />
        </div>

        {/* Filter by deck size. Built from data (lib/discoverFilters) so more
            filters can be added without changing this markup. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs uppercase tracking-[0.08em] text-faint">Size</span>
          {SIZE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === sizeId}
              onClick={() => setSizeId(f.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                f.id === sizeId
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {decksQuery.isLoading && <p className="text-sm text-muted">Loading decks…</p>}

      {decksQuery.isError && (
        <p className="text-sm text-danger">Couldn&apos;t load shared decks. Please try again.</p>
      )}

      {result && decks.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-ink">
            {query || sizeId !== "all"
              ? "No shared decks match your filters."
              : "No decks have been shared yet."}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {query || sizeId !== "all"
              ? "Try a broader search or a different size."
              : "Import one of your own and set it to public — it'll show up here."}
          </p>
        </Card>
      )}

      {decks.length > 0 && (
        <>
          <ul
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
              decksQuery.isPlaceholderData ? "opacity-60 transition-opacity" : ""
            }`}
          >
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link href={`/shared/${deck.id}`} className="block">
                  <Card hover className="overflow-hidden p-0">
                    <div className="h-1.5 bg-accent" />
                    <div className="space-y-2 p-5">
                      <p className="truncate font-display text-base font-semibold text-ink">
                        {deck.name}
                      </p>
                      <p className="inline-flex items-center gap-1.5 font-mono text-xs text-faint">
                        <Icon name="layers" size={13} />
                        {deck.cardCount ?? 0} card{deck.cardCount === 1 ? "" : "s"}
                      </p>
                      <DeckAuthor
                        authorName={deck.authorName}
                        sourceAuthorName={deck.sourceAuthorName}
                        className="block"
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          {result && result.totalPages > 1 && (
            <Pager
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              onPage={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

// Prev / page indicator / Next. Numbered pages are deliberately skipped — the
// directory is browsed, not addressed by page number, and prev/next stays clean
// no matter how many pages there are.
function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const atStart = page <= 0;
  const atEnd = page >= totalPages - 1;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-line pt-4"
    >
      <span className="text-xs text-muted">
        Page {page + 1} of {totalPages} · {total} deck{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={atStart}
          className="inline-flex items-center gap-1 rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="chevronLeft" size={15} />
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={atEnd}
          className="inline-flex items-center gap-1 rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </nav>
  );
}
