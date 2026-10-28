"use client";

import { useState } from "react";
import Link from "next/link";
import { useDecks, useRecentDecks, useSavedDecks } from "@/hooks/useDecks";
import { quickQuizDeck } from "@/lib/quickQuiz";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { StreakTile } from "@/components/home/StreakTile";
import { DeckGrid } from "@/components/home/DeckGrid";
import { FolderList } from "@/components/folders/FolderList";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/components/i18n/LocaleProvider";

type Tab = "yours" | "saved" | "recent" | "folders";

export default function HomePage() {
  const t = useT();
  const decksQuery = useDecks();
  const decks = decksQuery.data ?? [];
  const loaded = Boolean(decksQuery.data);

  const deckCount = decks.length;
  const totalCards = decks.reduce((sum, d) => sum + (d.cardCount ?? 0), 0);
  const avgCompletion = deckCount
    ? Math.round(decks.reduce((sum, d) => sum + (d.completion ?? 0), 0) / deckCount)
    : 0;
  // The quick-quiz tile used to open decks[0] — whichever deck the API listed first — and never
  // said which one it meant. Recent is already fetched for the tab below, so preferring the deck
  // you last opened costs no extra request.
  const recentForQuiz = useRecentDecks();
  const quizDeck = quickQuizDeck(recentForQuiz.data, decksQuery.data);

  const [tab, setTab] = useState<Tab>("yours");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* header. No "Import deck" button here: the top bar's "New deck" goes to the same screen
          and sits directly above this one, so the two read as a single action duplicated. The
          sidebar link and the Quick actions tile below still reach /import — four routes to one
          screen on one viewport was the problem, not having more than one. */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t("home.welcome")}</h1>
        <p className="mt-1 text-sm text-muted">{t("home.subtitle")}</p>
      </div>

      {/* stats: your study streak, then your own decks. On phones the streak takes the full
          first row and the two deck tiles share the second. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StreakTile className="col-span-2 sm:col-span-1" />
        <StatTile
          icon={<Icon name="layers" size={18} />}
          color="var(--info)"
          label={t("home.decks")}
          value={loaded ? deckCount : "—"}
          sub={loaded ? t("home.cardsTotal", { count: totalCards }) : undefined}
        />
        <StatTile
          icon={<Icon name="target" size={18} />}
          color="var(--success)"
          label={t("home.avgCompletion")}
          value={loaded ? `${avgCompletion}%` : "—"}
          sub={loaded ? t("home.acrossYourDecks") : undefined}
        />
      </div>

      {/* quick actions */}
      <div>
        <SectionLabel>{t("home.quickActions")}</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            icon="upload"
            color="var(--accent)"
            title={t("home.importTitle")}
            desc={t("home.importDesc")}
            cta={t("nav.importDeck")}
            href="/import"
          />
          <QuickAction
            icon="clipboard"
            color="var(--warning)"
            title={t("home.quickQuizTitle")}
            desc={
              quizDeck
                ? t("home.quickQuizFrom", { deck: quizDeck.name })
                : t("home.quickQuizNoDeck")
            }
            cta={quizDeck ? t("home.quizThisDeck") : t("home.newQuiz")}
            href={quizDeck ? `/decks/${quizDeck.id}?step=setup` : undefined}
          />
          <QuickAction
            icon="search"
            color="var(--success)"
            title={t("home.exploreTitle")}
            desc={t("home.exploreDesc")}
            cta={t("home.browseDiscover")}
            href="/discover"
          />
        </div>
      </div>

      {/* decks: your own / saved / recent */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <TabButton active={tab === "yours"} onClick={() => setTab("yours")}>
            {t("home.yourDecks")}
          </TabButton>
          <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
            {t("home.tabSaved")}
          </TabButton>
          <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
            {t("home.tabRecent")}
          </TabButton>
          <TabButton active={tab === "folders"} onClick={() => setTab("folders")}>
            {t("nav.folders")}
          </TabButton>
        </div>

        {tab === "yours" && (
          <DeckGrid
            query={decksQuery}
            emptyTitle={t("home.noDecks")}
            emptyAction={
              <Link href="/import" className={buttonClasses({ variant: "soft", size: "sm" })}>
                {t("home.importFirst")}
              </Link>
            }
          />
        )}
        {tab === "saved" && <SavedTab />}
        {tab === "recent" && <RecentTab />}
        {tab === "folders" && <FolderList />}
      </div>
    </div>
  );
}

function SavedTab() {
  const t = useT();
  const query = useSavedDecks();
  return (
    <DeckGrid
      query={query}
      showAuthor
      emptyTitle={t("home.noSaved")}
      emptyHint={t("home.noSavedHint")}
    />
  );
}

function RecentTab() {
  const t = useT();
  const query = useRecentDecks();
  return (
    <DeckGrid
      query={query}
      showAuthor
      emptyTitle={t("home.nothingRecent")}
      emptyHint={t("home.nothingRecentHint")}
    />
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
