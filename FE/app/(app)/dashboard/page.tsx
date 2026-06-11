"use client";

import Link from "next/link";
import { useDecks } from "@/hooks/useDecks";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { SoonTag } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";

export default function DashboardPage() {
  const decksQuery = useDecks();
  const decks = decksQuery.data ?? [];
  const loaded = Boolean(decksQuery.data);

  const deckCount = decks.length;
  const totalCards = decks.reduce((sum, d) => sum + (d.cardCount ?? 0), 0);
  const avgCompletion = deckCount
    ? Math.round(decks.reduce((sum, d) => sum + (d.completion ?? 0), 0) / deckCount)
    : 0;
  // Most-recent deck powers the "quick quiz" action; disabled until one exists.
  const firstDeckId = decks[0]?.id;

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

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          sub={loaded ? "across all decks" : undefined}
        />
        <StatTile
          icon={<Icon name="flame" size={18} />}
          color="var(--flame)"
          label="Current streak"
          value="—"
          soon
        />
        <StatTile
          icon={<Icon name="bolt" size={18} />}
          color="var(--accent)"
          label="Total XP"
          value="—"
          soon
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
            cta="Browse library"
            soon
          />
        </div>
      </div>

      {/* deck grid */}
      <div>
        <SectionLabel>Your decks</SectionLabel>

        {decksQuery.isLoading && <p className="text-sm text-muted">Loading…</p>}

        {decksQuery.isError && <p className="text-sm text-danger">Could not load decks.</p>}

        {loaded && deckCount === 0 && (
          <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
              <Icon name="cards" size={24} />
            </span>
            <p className="text-sm text-muted">No decks yet.</p>
            <Link href="/import" className={buttonClasses({ variant: "soft", size: "sm" })}>
              Import your first deck
            </Link>
          </Card>
        )}

        {loaded && deckCount > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => {
              const completion = Math.round(deck.completion ?? 0);
              return (
                <li key={deck.id}>
                  {/* Whole card is the link; delete moves to the deck detail page. */}
                  <Link href={`/decks/${deck.id}`} className="block">
                    <Card hover className="overflow-hidden p-0">
                      <div className="h-1.5 bg-accent" />
                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-base font-semibold text-ink">
                              {deck.name}
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-faint">
                              <Icon name="layers" size={13} />
                              {deck.cardCount ?? 0} cards
                            </p>
                          </div>
                          <Ring value={completion / 100} size={46} label={`${completion}%`} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// A monospace section eyebrow, matching the reference dashboard/deck headings.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
      {children}
    </p>
  );
}

// A quick-action launcher. Renders as a link when `href` is set; `soon` (or no
// href) greys it into a non-interactive "coming soon" tile.
function QuickAction({
  icon,
  title,
  desc,
  cta,
  color = "var(--accent)",
  href,
  soon = false,
}: {
  icon: IconName;
  title: string;
  desc: string;
  cta: string;
  color?: string;
  href?: string;
  soon?: boolean;
}) {
  const disabled = soon || !href;
  const inner = (
    <Card hover={!disabled} className={`flex h-full flex-col p-5 ${disabled ? "opacity-70" : ""}`}>
      <span
        className="mb-3.5 grid h-10 w-10 place-items-center rounded-input"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon name={icon} size={21} />
      </span>
      <div className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-ink">
        {title}
        {soon && <SoonTag />}
      </div>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted">{desc}</p>
      <div className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color }}>
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
