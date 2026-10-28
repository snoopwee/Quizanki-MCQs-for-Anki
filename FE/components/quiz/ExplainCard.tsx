"use client";

import { useState } from "react";
import { useExplainCard } from "@/hooks/useAi";
import { aiErrorMessage } from "@/lib/aiDisplay";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/components/i18n/LocaleProvider";

/**
 * "Why?" on a card the learner just missed.
 *
 * <p>AI help in its smallest useful form: the moment someone gets a card wrong is the moment the
 * reason is worth most, and it is already on screen in the results list — so this asks for two or
 * three sentences in place rather than sending anyone to a chat window.
 *
 * <p><b>Opt-in per card.</b> It is a button, not an automatic fetch, because the answers come from
 * a shared free-tier pool: nobody should spend a generation on a card they were not curious about.
 * (The server caches per card, so the second person to ask about a card spends nothing at all.)
 *
 * <p>When explanations are switched off the server answers 503, and the failure is shown as one
 * muted line in place of the button. That is honest, but a dead button until it is pressed —
 * the proper fix is an AI flag on {@code /public/config}, which the "Generate with AI" tab needs
 * for the same reason.
 */
export function ExplainCard({ question, answer }: { question: string; answer: string }) {
  const t = useT();
  const explain = useExplainCard();
  const [open, setOpen] = useState(false);

  function ask() {
    setOpen(true);
    // Already have it (or already asking) — reopening must not spend a second generation.
    if (explain.data || explain.isPending) return;
    explain.mutate({ question, answer });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={ask}
        className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-input px-1.5 py-1 text-xs font-medium text-accent-ink transition hover:bg-accent-soft"
      >
        <Icon name="brain" size={14} />
        {t("quiz.explainAsk")}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-input border border-line bg-surface-2/60 px-3 py-2 text-xs leading-relaxed">
      {explain.isPending && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner className="h-3.5 w-3.5" /> {t("quiz.explainThinking")}
        </p>
      )}

      {explain.isError && (
        <p className="flex items-start gap-1.5 text-muted">
          <Icon name="alertTriangle" size={13} className="mt-0.5 shrink-0" />
          {aiErrorMessage(explain.error)}
        </p>
      )}

      {explain.data && (
        // Plain text on purpose: the server returns prose, not Markdown or HTML, so rendering it
        // as text keeps a chatty model from becoming an injection surface.
        <p className="whitespace-pre-line text-ink">{explain.data.explanation}</p>
      )}
    </div>
  );
}
