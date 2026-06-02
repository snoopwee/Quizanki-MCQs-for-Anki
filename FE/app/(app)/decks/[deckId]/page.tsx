"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDeckContents, useDeleteDeck } from "@/hooks/useDecks";
import { useNotes } from "@/hooks/useNotes";
import { useStartSession } from "@/hooks/useQuizSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { ExportDeckModal } from "@/components/deck/ExportDeckModal";

type Step = "flashcards" | "setup";

export default function DeckDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading deck…</p>}>
      <DeckDetail />
    </Suspense>
  );
}

function DeckDetail() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  // `?step=setup` keeps the user on the quiz-setup screen across the round-trip
  // through the test page. Default (no param) is the flashcard browser.
  const params = useSearchParams();
  const step: Step = params.get("step") === "setup" ? "setup" : "flashcards";

  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const startSession = useStartSession();
  const startQuiz = useQuizStore((s) => s.startSession);
  const deleteDeck = useDeleteDeck();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const parsed = useMemo(
    () => (contentsQuery.data ? deckContentsToParsed(contentsQuery.data) : null),
    [contentsQuery.data],
  );

  // Pair each note with its server-side card_stats so selectQuizNotes can
  // weight by mastery and (per the Anki-like rule) hold new cards back until
  // some seen cards reach the ready threshold.
  const getStats: NoteStatsLookup = useMemo(() => {
    const map = new Map<string, { mastery: number; timesSeen: number }>();
    for (const n of notesQuery.data ?? []) {
      const s = n.cardStats;
      map.set(n.id, {
        mastery: s?.mastery ?? 0,
        timesSeen: s?.timesSeen ?? 0,
      });
    }
    return (noteId) => map.get(noteId);
  }, [notesQuery.data]);

  function goToSetup() {
    router.push(`/decks/${deckId}?step=setup`);
  }
  function goToFlashcards() {
    router.push(`/decks/${deckId}`);
  }

  function startTest(questions: Question[]) {
    const shuffled = reshuffleQuestions(questions);
    startSession.mutate(
      { deckId, questionCount: shuffled.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          startQuiz(shuffled, session.sessionId);
          router.push(`/decks/${deckId}/test`);
        },
      },
    );
  }

  function confirmDelete() {
    deleteDeck.mutate(deckId, {
      onSuccess: () => router.push("/dashboard"),
    });
  }

  if (contentsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-neutral-500">Loading deck…</p>
      </div>
    );
  }

  if (contentsQuery.isError || !parsed || !contentsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-sm text-neutral-500">Deck not found.</p>
        <Link href="/dashboard" className="text-sm font-medium underline">
          Back to decks
        </Link>
      </div>
    );
  }

  const deckName = contentsQuery.data.name;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          // When on the setup step, the deck name becomes a link back to the
          // flashcard view; on the flashcard view it's the current page (no href).
          step === "setup"
            ? { label: deckName, href: `/decks/${deckId}` }
            : { label: deckName },
          ...(step === "setup" ? [{ label: "Set up quiz" }] : []),
        ]}
      />

      {step === "flashcards" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goToSetup}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Set up a quiz →
            </button>
            <div className="ml-auto">
              <KebabMenu
                label="Deck options"
                items={[
                  { label: "Edit flashcards", onClick: () => router.push(`/decks/${deckId}/edit`) },
                  { label: "Export deck", onClick: () => setExportOpen(true) },
                  { label: "Delete deck", onClick: () => setDeleteOpen(true), danger: true },
                ]}
              />
            </div>
          </div>

          <FlashcardViewer
            parsed={parsed}
            completion={contentsQuery.data.completion}
            getStats={getStats}
            hideActions
            editable
            deckId={deckId}
            onBack={() => router.push("/dashboard")}
            onStartTest={goToSetup}
          />
        </>
      )}

      {step === "setup" && (
        <ApkgQuizSetup
          parsed={parsed}
          getStats={getStats}
          deckId={deckId}
          showHeading={false}
          backLabel="Back to flashcards"
          onBack={goToFlashcards}
          onStart={startTest}
        />
      )}

      {exportOpen && (
        <ExportDeckModal
          contents={contentsQuery.data}
          onClose={() => setExportOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteConfirm
          deckName={deckName}
          busy={deleteDeck.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-neutral-500">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-neutral-900 dark:text-neutral-100" : ""}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden className="text-neutral-300 dark:text-neutral-700">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function DeleteConfirm({
  deckName,
  busy,
  onCancel,
  onConfirm,
}: {
  deckName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Lightweight inline confirmation — Modal would be overkill for one yes/no.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">Delete this deck?</h2>
          <p className="mt-1 text-sm text-neutral-500">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{deckName}</span>{" "}
            and all of its progress will be removed. This can&apos;t be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete deck"}
          </button>
        </div>
      </div>
    </div>
  );
}
