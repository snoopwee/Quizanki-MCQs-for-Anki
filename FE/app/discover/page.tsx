"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDiscoverDecks, type DiscoverSort } from "@/hooks/useDecks";
import { AppChrome } from "@/components/layout/AppChrome";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { StarRating } from "@/components/ui/StarRating";
import { SIZE_FILTERS, sizeFilterById } from "@/lib/discoverFilters";
import { useT } from "@/components/i18n/LocaleProvider";

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
  const t = useT();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sizeId, setSizeId] = useState("all");
  const [sort, setSort] = useState<DiscoverSort>("new");
  const [page, setPage] = useState(0); // zero-based

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Any change to what's being asked for resets to the first page — otherwise a
  // filter could land you on a page that no longer exists.
  useEffect(() => setPage(0), [query, sizeId, sort]);

  const size = sizeFilterById(sizeId);
  const params = useMemo(
    () => ({ q: query, minCards: size.min, maxCards: size.max, page, pageSize: PAGE_SIZE, sort }),
    [query, size.min, size.max, page, sort],
  );

  const decksQuery = useDiscoverDecks(params);
  const result = decksQuery.data;
  const decks = result?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t("discover.heading")}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          {t("discover.lede")}
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
            aria-label={t("discover.searchLabel")}
            placeholder={t("discover.searchPlaceholder")}
            className="focus-ring w-full rounded-input border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint"
          />
        </div>

        {/* Filter by deck size. Built from data (lib/discoverFilters) so more
            filters can be added without changing this markup. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs uppercase tracking-[0.08em] text-faint">{t("discover.size")}</span>
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs uppercase tracking-[0.08em] text-faint">{t("discover.sort")}</span>
          {([
            { id: "new", label: t("discover.sortNewest") },
            { id: "rated", label: t("discover.sortBestRated") },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === sort}
              onClick={() => setSort(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                option.id === sort
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {decksQuery.isLoading && <p className="text-sm text-muted">{t("discover.loading")}</p>}

      {decksQuery.isError && (
        <p className="text-sm text-danger">{t("discover.loadFailed")}</p>
      )}

      {result && decks.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-ink">
            {query || sizeId !== "all"
              ? t("discover.noMatch")
              : t("discover.noneShared")}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {query || sizeId !== "all"
              ? t("discover.noMatchHint")
              : t("discover.noneSharedHint")}
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
                {/* Stretched-link card: the whole card is clickable via an overlay
                    link, so the author link inside stays a real (non-nested) link. */}
                <Card hover className="relative overflow-hidden p-0">
                  <div className="h-1.5 bg-accent" />
                  <div className="space-y-2 p-5">
                    <p
                      title={deck.name}
                      className="line-clamp-2 break-words font-display text-base font-semibold text-ink"
                    >
                      {deck.name}
                    </p>
                    {/* Card count and score share a row, as on every other deck surface. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-faint">
                        <Icon name="layers" size={13} />
                        {t("deck.cardCount", { count: deck.cardCount ?? 0 })}
                      </span>
                      <StarRating average={deck.ratingAverage} count={deck.ratingCount} size={13} />
                    </div>
                    {/* Its own line, so `plain` rather than `dot` — a separator at the start of a
                        line has nothing to separate it from. No avatar on Discover. */}
                    <DeckAuthor
                      authorId={deck.authorId}
                      authorUsername={deck.authorUsername}
                      authorName={deck.authorName}
                      sourceAuthorName={deck.sourceAuthorName}
                      variant="plain"
                      className="relative z-20"
                    />
                  </div>
                  <Link
                    href={`/shared/${deck.id}`}
                    aria-label={deck.name}
                    className="absolute inset-0 z-10"
                  />
                </Card>
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
