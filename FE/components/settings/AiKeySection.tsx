"use client";

import { useState } from "react";
import { AccountSection } from "@/components/account/AccountSection";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useAiKeyStatus, useDeleteAiKey, useSaveAiKey } from "@/hooks/useAi";
import { aiErrorMessage } from "@/lib/aiDisplay";

const PROVIDER = "gemini";

// Settings → AI. Two reasons a learner would add their own key: a much larger daily allowance,
// and their material going to their own provider account instead of our shared free tier.
//
// The key is encrypted before storage and never comes back to the browser — the most this screen
// ever shows is its last four characters.
export function AiKeySection() {
  const status = useAiKeyStatus();
  const save = useSaveAiKey();
  const remove = useDeleteAiKey();
  const [apiKey, setApiKey] = useState("");

  const supported = status.data?.supported ?? false;
  const configured = status.data?.configured ?? false;

  function submit() {
    const key = apiKey.trim();
    if (!key || save.isPending) return;
    save.mutate({ provider: PROVIDER, apiKey: key }, { onSuccess: () => setApiKey("") });
  }

  return (
    <AccountSection
      icon="bolt"
      title="AI generation"
      description="Turn notes or a PDF into a draft deck. Add your own API key for a bigger daily allowance and to keep your material on your own provider account."
    >
      {status.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" label="Loading" />
          Loading…
        </div>
      ) : status.isError ? (
        <p className="text-sm text-muted">Couldn&apos;t load your AI settings.</p>
      ) : !supported ? (
        <p className="text-sm text-muted">
          This server isn&apos;t set up to store personal API keys, so AI generation uses the shared
          free allowance only.
        </p>
      ) : (
        <div className="space-y-4">
          {configured && (
            <div className="flex flex-wrap items-center gap-3 rounded-input border border-success/30 bg-success/5 p-3">
              <Icon name="check" size={16} className="shrink-0 text-success" />
              <p className="min-w-0 flex-1 text-sm text-ink">
                Your own key is in use
                <span className="ml-1 font-mono text-xs text-muted">(…{status.data?.hint})</span>
              </p>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                {remove.isPending && <Spinner className="h-3.5 w-3.5 text-muted" label="Removing" />}
                Remove
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ai-api-key" className="block text-xs font-medium text-muted">
              {configured ? "Replace your API key" : "Your Gemini API key"}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="ai-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your key"
                className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-ink"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!apiKey.trim() || save.isPending}
                className={buttonClasses({ variant: "primary" })}
              >
                {save.isPending && <Spinner className="h-4 w-4 text-white" label="Saving" />}
                Save key
              </button>
            </div>
            {save.isError && (
              <p className="flex items-center gap-1.5 text-sm text-danger">
                <Icon name="alertTriangle" size={14} /> {aiErrorMessage(save.error)}
              </p>
            )}
            {remove.isError && (
              <p className="flex items-center gap-1.5 text-sm text-danger">
                <Icon name="alertTriangle" size={14} /> {aiErrorMessage(remove.error)}
              </p>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-faint">
            <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
            Stored encrypted. It never comes back to this page and is only used on the server to
            generate your cards.
          </p>
        </div>
      )}
    </AccountSection>
  );
}
