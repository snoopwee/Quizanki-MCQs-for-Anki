"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDeckContents } from "@/hooks/useDecks";
import { useNotes, useToggleStar } from "@/hooks/useNotes";
import { invalidateAfterAnswer, useRecordAnswer, useStartSession } from "@/hooks/useQuizSession";
import { useSpeechSupported } from "@/hooks/useSpeech";
import { deckContentsToParsed } from "@/lib/deckContents";
import { buildCardTemplates, type CardTemplate } from "@/lib/buildQuestions";
import { applyAnswer } from "@/lib/mastery";
import { loadQuizPreferences } from "@/lib/quizPreferences";
import {
  buildAllCardsSpecs,
  collectStarredIds,
  initialPrefsByType,
  isQuizable,
  type NoteStatsLookup,
} from "@/lib/quizDeckSpecs";
import {
  DEFAULT_LEARN_PREFS,
  effectiveLearnCount,
  loadLearnPreferences,
  saveLearnPreferences,
  type LearnPreferences,
} from "@/lib/learnPreferences";
import {
  countLearnableCards,
  learnEligibleIds,
  learnSpecs,
  stageCounts,
  summarizeLearnSession,
  type LearnSession,
  type LearnSummary,
} from "@/lib/learnSession";
import type { MasteryStage } from "@/lib/masteryStage";
import { LearnSessionView } from "@/components/learn/LearnSessionView";
import { LearnSettingsModal } from "@/components/learn/LearnSettingsModal";
import { LearnSummaryView } from "@/components/learn/LearnSummaryView";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";

// A running session: its backend session id (every answer is logged under it, so the
// stats chart gets one point per session) and the cards it learns.
interface Run {
  id: number;
  sessionId: string;
  templates: CardTemplate[];
  prefs: LearnPreferences;
}

// Learn mode — the study page. Signed-in only (it lives under the auth-guarded app), full
// screen like the quiz (AppShell hides the sidebar for /learn). Loads the deck itself, so a
// refresh or direct link works. Every answer is recorded with source "learn": it moves
// mastery like a quiz answer and marks today on the streak.
export default function DeckLearnPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const toggleStar = useToggleStar(deckId);
  const startSession = useStartSession();
  const recordAnswer = useRecordAnswer();
  const speechSupported = useSpeechSupported();

  const parsed = useMemo(
    () => (contentsQuery.data ? deckContentsToParsed(contentsQuery.data) : null),
    [contentsQuery.data],
  );
  const quizable = useMemo(() => parsed?.noteTypes.filter(isQuizable) ?? [], [parsed]);

  const getStats: NoteStatsLookup = useMemo(() => {
    const map = new Map<string, { mastery: number; timesSeen: number; starred: boolean }>();
    for (const n of notesQuery.data ?? []) {
      const s = n.cardStats;
      map.set(n.id, {
        mastery: s?.mastery ?? 0,
        timesSeen: s?.timesSeen ?? 0,
        starred: s?.starred ?? false,
      });
    }
    return (noteId) => map.get(noteId);
  }, [notesQuery.data]);

  const getStarred = (id: string) => getStats(id)?.starred ?? false;
  const onToggleStar = (id: string, next: boolean) => toggleStar.mutate({ noteId: id, starred: next });

  const [prefs, setPrefs] = useState<LearnPreferences>(DEFAULT_LEARN_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // No saved settings for this deck yet: open the settings before the first session.
  const [firstVisit, setFirstVisit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [finished, setFinished] = useState<{ summary: LearnSummary; stages: Record<MasteryStage, number> } | null>(null);
  const [empty, setEmpty] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const runIdRef = useRef(0);
  const autoStartedRef = useRef(false);
  // Mastery of this session's cards as answers land, mirroring the backend's curve, so the
  // summary is right before the notes refetch returns.
  const masteryRef = useRef(new Map<string, { mastery: number; timesSeen: number }>());

  // Settings live in localStorage, which only exists in the browser — read after mount.
  useEffect(() => {
    const saved = loadLearnPreferences(deckId);
    if (saved) {
      setPrefs(saved);
    } else {
      setFirstVisit(true);
      setSettingsOpen(true);
    }
    setPrefsLoaded(true);
  }, [deckId]);

  function exit() {
    router.push(`/decks/${deckId}`);
  }

  function start(next: LearnPreferences) {
    if (!parsed) return;
    autoStartedRef.current = true;
    saveLearnPreferences(deckId, next);
    setPrefs(next);
    setFirstVisit(false);
    setFinished(null);
    setStartFailed(false);

    // Same field picks as the deck's quiz setup (its saved choices, else the card layout).
    const basicTypes = quizable.filter((t) => !t.cloze);
    const fieldPrefs = initialPrefsByType(basicTypes, loadQuizPreferences(deckId));
    const specs = learnSpecs(buildAllCardsSpecs(quizable, fieldPrefs, getStats), next.answerWith);
    const eligible = learnEligibleIds(quizable, getStats, next);
    const count = effectiveLearnCount(next.count, countLearnableCards(quizable, eligible));
    const templates = count > 0 ? buildCardTemplates(specs, count, Math.random, eligible) : [];
    if (templates.length === 0) {
      setRun(null);
      setEmpty(true);
      return;
    }
    setEmpty(false);
    masteryRef.current = new Map(
      templates.map((t): [string, { mastery: number; timesSeen: number }] => {
        const s = getStats(t.base.noteId);
        return [t.base.noteId, { mastery: s?.mastery ?? 0, timesSeen: s?.timesSeen ?? 0 }];
      }),
    );
    startSession.mutate(
      { deckId, questionCount: templates.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          runIdRef.current += 1;
          setRun({ id: runIdRef.current, sessionId: session.sessionId, templates, prefs: next });
        },
        onError: () => {
          setRun(null);
          setStartFailed(true);
        },
      },
    );
  }

  // Start straight away on a return visit, once the deck, the card stats (for mastery
  // weighting and stars) and the saved settings are in.
  const ready = Boolean(parsed) && !notesQuery.isLoading && prefsLoaded;
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (!ready || firstVisit || autoStartedRef.current) return;
    startRef.current(prefs);
  }, [ready, firstVisit, prefs]);

  function handleAnswer(noteId: string, correct: boolean) {
    const prev = masteryRef.current.get(noteId) ?? { mastery: 0, timesSeen: 0 };
    masteryRef.current.set(noteId, {
      mastery: applyAnswer(prev.mastery, correct),
      timesSeen: prev.timesSeen + 1,
    });
    if (!run) return;
    recordAnswer.mutate(
      { sessionId: run.sessionId, noteId, correct, source: "learn" },
      { onSuccess: () => invalidateAfterAnswer(queryClient) },
    );
  }

  function handleComplete(session: LearnSession) {
    setFinished({
      summary: summarizeLearnSession(session),
      stages: stageCounts(session.cards, (id) => masteryRef.current.get(id)),
    });
  }

  if (contentsQuery.isLoading || (contentsQuery.data && !ready)) {
    return (
      <CenteredStatus>
        <Spinner className="h-5 w-5 text-accent" label="Loading deck" />
        Loading deck…
      </CenteredStatus>
    );
  }

  if (contentsQuery.isError || !contentsQuery.data || !parsed) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <p className="text-sm text-muted">Deck not found.</p>
        <Link href="/home" className="text-sm font-medium text-accent hover:underline">
          Back to decks
        </Link>
      </div>
    );
  }

  let body: ReactNode;
  if (startSession.isPending) {
    body = (
      <CenteredStatus>
        <Spinner className="h-5 w-5 text-accent" label="Starting session" />
        Starting your session…
      </CenteredStatus>
    );
  } else if (finished) {
    body = (
      <LearnSummaryView
        summary={finished.summary}
        stages={finished.stages}
        onKeepLearning={() => start(prefs)}
        onExit={exit}
      />
    );
  } else if (startFailed) {
    body = (
      <StatusCard
        title="Couldn't start a session"
        text="Check your connection and try again."
        primary={{ label: "Try again", onClick: () => start(prefs) }}
        secondary={{ label: "Back to deck", onClick: exit }}
      />
    );
  } else if (empty) {
    body = (
      <StatusCard
        title="Nothing to learn with these settings"
        text={emptyReason(prefs)}
        primary={{ label: "Change settings", onClick: () => setSettingsOpen(true) }}
        secondary={{ label: "Back to deck", onClick: exit }}
      />
    );
  } else if (run) {
    body = (
      <LearnSessionView
        key={run.id}
        templates={run.templates}
        prefs={run.prefs}
        paused={settingsOpen}
        onAnswer={handleAnswer}
        onComplete={handleComplete}
        onExit={exit}
        onOpenSettings={() => setSettingsOpen(true)}
        getStarred={getStarred}
        onToggleStar={onToggleStar}
      />
    );
  } else if (firstVisit) {
    body = <CenteredStatus>Choose how you want to learn {contentsQuery.data.name}.</CenteredStatus>;
  } else {
    body = (
      <CenteredStatus>
        <Spinner className="h-5 w-5 text-accent" label="Starting session" />
        Starting your session…
      </CenteredStatus>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      {body}
      {settingsOpen && (
        <LearnSettingsModal
          initial={prefs}
          available={(filters) => countLearnableCards(quizable, learnEligibleIds(quizable, getStats, filters))}
          starredCount={collectStarredIds(quizable, getStats).size}
          speechSupported={speechSupported}
          mode={run && !finished ? "restart" : "start"}
          onApply={(next) => {
            setSettingsOpen(false);
            start(next);
          }}
          onClose={() => {
            setSettingsOpen(false);
            // Closing the first-visit settings without starting leaves Learn.
            if (firstVisit && !run) exit();
          }}
        />
      )}
    </div>
  );
}

// Why a session came up empty, and what to change.
function emptyReason(prefs: LearnPreferences): string {
  if (prefs.starredOnly && !prefs.includeMastered)
    return "Every starred card is already mastered. Star more cards, or include mastered cards.";
  if (prefs.starredOnly) return "No starred cards here yet. Star a few, or turn off Starred cards only.";
  if (!prefs.includeMastered)
    return "Every card here is already mastered. Turn on Include mastered cards to review them.";
  return "This deck has no cards Learn can ask. Each card needs a question and an answer.";
}

function CenteredStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2.5 p-6 text-sm text-muted">
      {children}
    </div>
  );
}

function StatusCard({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text: string;
  primary: { label: string; onClick: () => void };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <Card className="mx-auto mt-[12vh] max-w-lg space-y-4 p-6 text-center">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={secondary.onClick} className={buttonClasses({ variant: "ghost" })}>
          {secondary.label}
        </button>
        <button type="button" onClick={primary.onClick} className={buttonClasses({ variant: "primary" })}>
          {primary.label}
        </button>
      </div>
    </Card>
  );
}
