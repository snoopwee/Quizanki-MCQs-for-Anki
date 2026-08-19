"use client";

import { useState } from "react";
import Link from "next/link";
import { useDecks, useRecentDecks, useSavedDecks } from "@/hooks/useDecks";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClasses } from "@/components/ui/Button";
import type { DeckResponse } from "@/types/api";

type Tab = "yours" | "saved" | "recent";

export default function HomePage() {
  const decksQuery = useDecks();
  const decks = decksQuery.data ?? [];
  const loaded = Boolean(decksQuery.data);

  const deckCount = decks.length;
  const totalCards = decks.reduce((sum, d) => sum + (d.cardCount ?? 0), 0);
  const avgCompletion = deckCount
    ? Math.round(decks.reduce((sum, d) => sum + (d.completion ?? 0), 0) / deckCount)
    : 0;
  const firstDeckId = decks[0]?.id;

  const [tab, setTab] = useState<Tab>("yours");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Pick up where you left off.</p>
        </div>
        <Link href="/import" className={buttonClasses({ variant: "primary" })}>
          <Icon name="upload" size={17} /> Import deck
        </Link>
      </div>

      {/* stats (your own decks) */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Icon name="layers" size={18} />}
          color="var(--info)"
          label="Decks"
          value={loaded ? deckCount : "—"}
          sub={loaded ? `${totalCards} cards total` : undefined}
        />
        <StatTile
          icon={<Icon name="target" size={18} />}
          color="var(--success)"
          label="Avg. completion"
          value={loaded ? `${avgCompletion}%` : "—"}
          sub={loaded ? "across your decks" : undefined}
        />
      </div>

      {/* quick actions */}
      <div>
        <SectionLabel>Quick actions</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            icon="upload"
            color="var(--accent)"
            title="Import an Anki deck"
            desc="Drop an .apkg file and we'll turn every card into a multiple-choice quiz."
            cta="Import deck"
            href="/import"
          />
          <QuickAction
            icon="clipboard"
            color="var(--warning)"
            title="Start a quick quiz"
            desc="Jump straight into an MCQ test built from one of your decks."
            cta="New quiz"
            href={firstDeckId ? `/decks/${firstDeckId}?step=setup` : undefined}
          />
          <QuickAction
            icon="search"
            color="var(--success)"
            title="Explore shared decks"
            desc="Browse decks shared by other learners — Japanese, Spanish, and more."
            cta="Browse Discover"
            href="/discover"
          />
        </div>
      </div>

      {/* decks: your own / saved / recent */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <TabButton active={tab === "yours"} onClick={() => setTab("yours")}>
            Your decks
          </TabButton>
          <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
            Saved
          </TabButton>
          <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
            Recent
          </TabButton>
        </div>

        {tab === "yours" && (
          <DeckGridSection
            query={decksQuery}
            emptyTitle="No decks yet."
            emptyAction={
              <Link href="/import" className={buttonClasses({ variant: "soft", size: "sm" })}>
                Import your first deck
              </Link>
            }
          />
        )}
        {tab === "saved" && <SavedTab />}
        {tab === "recent" && <RecentTab />}
      </div>
    </div>
  );
}

function SavedTab() {
  const query = useSavedDecks();
  return (
    <DeckGridSection
      query={query}
      showAuthor
      emptyTitle="No saved decks."
      emptyHint="Open a shared deck and hit “Save to Home” to keep it here."
    />
  );
}

function RecentTab() {
  const query = useRecentDecks();
  return (
    <DeckGridSection
      query={query}
      showAuthor
      emptyTitle="Nothing recent."
      emptyHint="Decks you open show up here for 30 days."
    />
  );
}

// One tab's deck grid, with its own loading / error / empty states.
function DeckGridSection({
  query,
  showAuthor = false,
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  query: { data?: DeckResponse[]; isLoading: boolean; isError: boolean };
  showAuthor?: boolean;
  emptyTitle: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
}) {
  const decks = query.data ?? [];

  if (query.isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (query.isError) return <p className="text-sm text-danger">Could not load decks.</p>;

  if (decks.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
          <Icon name="cards" size={24} />
        </span>
        <p className="text-sm font-medium text-ink">{emptyTitle}</p>
        {emptyHint && <p className="max-w-xs text-sm text-muted">{emptyHint}</p>}
        {emptyAction}
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {decks.map((deck) => (
        <li key={deck.id}>
          {/* Stretched-link card so the author link inside isn't nested in the
              card link (nested <a> is invalid HTML). */}
          <Card hover className="relative overflow-hidden p-0">
            <div className="h-1.5 bg-accent" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    title={deck.name}
                    className="truncate font-display text-base font-semibold text-ink"
                  >
                    {deck.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="layers" size={13} />
                      {deck.cardCount ?? 0} cards
                    </span>
                    {deck.isPublic && (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Icon name="link" size={13} />
                        Shared
                      </span>
                    )}
                  </p>
                  {showAuthor && (
                    <DeckAuthor
                      authorId={deck.authorId}
                      authorName={deck.authorName}
                      authorAvatarUrl={deck.authorAvatarUrl}
                      sourceAuthorName={deck.sourceAuthorName}
                      className="relative z-20 mt-1.5"
                    />
                  )}
                </div>
                <Ring value={Math.round(deck.completion ?? 0) / 100} size={46} label={`${Math.round(deck.completion ?? 0)}%`} />
              </div>
            </div>
            <Link
              href={`/decks/${deck.id}`}
              aria-label={deck.name}
              className="absolute inset-0 z-10"
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
      {children}
    </p>
  );
}

// A quick-action launcher. Renders as a link when `href` is set; otherwise greys
// into a non-interactive tile.
function QuickAction({
  icon,
  title,
  desc,
  cta,
  color = "var(--accent)",
  href,
}: {
  icon: IconName;
  title: string;
  desc: string;
  cta: string;
  color?: string;
  href?: string;
}) {
  const disabled = !href;
  const inner = (
    <Card hover={!disabled} className={`flex h-full flex-col p-5 ${disabled ? "opacity-70" : ""}`}>
      <span
        className="mb-3.5 grid h-10 w-10 place-items-center rounded-input"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon name={icon} size={21} />
      </span>
      <div className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-tight text-ink">{title}</div>
      <p className="mt-1 flex-1 text-[0.8125rem] leading-relaxed text-muted">{desc}</p>
      <div className="mt-3.5 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold" style={{ color }}>
        {cta} <Icon name="chevronRight" size={14} />
      </div>
    </Card>
  );

  if (disabled) return <div aria-disabled className="cursor-not-allowed">{inner}</div>;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
