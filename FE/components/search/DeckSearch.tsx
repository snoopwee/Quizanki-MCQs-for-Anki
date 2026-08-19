"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDecks } from "@/hooks/useDecks";
import { Icon } from "@/components/ui/icons";

const MAX_RESULTS = 8;

// Top-bar search over the learner's own decks (by name). Built as a source-list
// so a second "Shared decks" section (remote/public search) can slot in later —
// see the marker below. Client-side filter over the already-cached deck list, so
// results are instant and cost no extra request.
export function DeckSearch() {
  const router = useRouter();
  const { data: decks, isLoading } = useDecks();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const list = decks ?? [];
    const q = query.trim().toLowerCase();
    const matched = q ? list.filter((d) => d.name.toLowerCase().includes(q)) : list;
    return matched.slice(0, MAX_RESULTS);
  }, [decks, query]);

  // Keep the highlighted row in range as the result set changes.
  useEffect(() => setActive(0), [query, open]);

  // Close on click outside (mousedown so it beats the input's focus handler).
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function goToDeck(id: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(`/decks/${id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const pick = results[active];
      if (pick) {
        e.preventDefault();
        goToDeck(pick.id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const activeId = open && results[active] ? `deck-search-opt-${results[active].id}` : undefined;
  const trimmed = query.trim();

  return (
    <div ref={rootRef} className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
        <Icon name="search" size={16} />
      </span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="deck-search-list"
        aria-activedescendant={activeId}
        aria-label="Search your decks"
        autoComplete="off"
        placeholder="Search your decks…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="focus-ring w-full rounded-input border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {isLoading ? (
            <p className="px-3 py-3 text-sm text-muted">Loading your decks…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">
              {trimmed ? `No decks match “${trimmed}”.` : "You don’t have any decks yet."}
            </p>
          ) : (
            <div className="py-1">
              <p className="px-3 pb-1 pt-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">
                Your decks
              </p>
              <ul id="deck-search-list" role="listbox" className="max-h-80 overflow-y-auto">
                {results.map((deck, i) => (
                  <li key={deck.id} id={`deck-search-opt-${deck.id}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/decks/${deck.id}`}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                        i === active ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      <Icon name="cards" size={16} className="shrink-0 text-faint" />
                      <span className="min-w-0 flex-1 truncate">{highlight(deck.name, trimmed)}</span>
                      <span className="shrink-0 text-xs text-faint">
                        {deck.cardCount ?? 0} card{deck.cardCount === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Future: a second role="listbox" section here for shareable/public
                  decks fed by a remote search — this component already lays the
                  results out as labeled source sections for exactly that. */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Bold the matched span of a deck name so the reason it surfaced is obvious.
function highlight(name: string, query: string): ReactNode {
  if (!query) return name;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <strong className="font-semibold text-accent-ink">{name.slice(idx, idx + query.length)}</strong>
      {name.slice(idx + query.length)}
    </>
  );
}
