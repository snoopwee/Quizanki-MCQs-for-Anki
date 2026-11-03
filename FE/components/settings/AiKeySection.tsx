"use client";

import { useState } from "react";
import { AccountSection } from "@/components/account/AccountSection";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useAiKeyStatus, useDeleteAiKey, useSaveAiKey } from "@/hooks/useAi";
import { aiErrorKey, type AiErrorText } from "@/lib/aiDisplay";
import { useT } from "@/components/i18n/LocaleProvider";

const PROVIDER = "gemini";

// Settings → AI. Two reasons a learner would add their own key: a much larger daily allowance,
// and their material going to their own provider account instead of our shared free tier.
//
// The key is encrypted before storage and never comes back to the browser — the most this screen
// ever shows is its last four characters.
export function AiKeySection() {
  const t = useT();
  const status = useAiKeyStatus();
  const save = useSaveAiKey();
  const remove = useDeleteAiKey();
  const [apiKey, setApiKey] = useState("");

  const supported = status.data?.supported ?? false;
  const configured = status.data?.configured ?? false;

  // The API's own sentence when it sent one, our catalogue otherwise — see `aiErrorKey`.
  function errorText(e: AiErrorText): string {
    return "key" in e ? t(e.key) : e.text;
  }

  function submit() {
    const key = apiKey.trim();
    if (!key || save.isPending) return;
    save.mutate({ provider: PROVIDER, apiKey: key }, { onSuccess: () => setApiKey("") });
  }

  return (
    <AccountSection
      icon="bolt"
      title={t("settings.ai")}
      description={t("settings.aiDesc")}
    >
      {status.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" label={t("common.loading")} />
          {t("common.loading")}
        </div>
      ) : status.isError ? (
        <p className="text-sm text-muted">{t("settings.aiLoadFailed")}</p>
      ) : !supported ? (
        <p className="text-sm text-muted">{t("settings.aiUnsupported")}</p>
      ) : (
        <div className="space-y-4">
          {configured && (
            <div className="flex flex-wrap items-center gap-3 rounded-input border border-success/30 bg-success/5 p-3">
              <Icon name="check" size={16} className="shrink-0 text-success" />
              <p className="min-w-0 flex-1 text-sm text-ink">
                {t("settings.aiKeyInUse")}
                <span className="ml-1 font-mono text-xs text-muted">(…{status.data?.hint})</span>
              </p>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                {remove.isPending && (
                  <Spinner className="h-3.5 w-3.5 text-muted" label={t("common.remove")} />
                )}
                {t("common.remove")}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ai-api-key" className="block text-xs font-medium text-muted">
              {configured ? t("settings.aiReplaceKey") : t("settings.aiYourKey")}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="ai-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("settings.aiKeyPlaceholder")}
                className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-ink"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!apiKey.trim() || save.isPending}
                className={buttonClasses({ variant: "primary" })}
              >
                {save.isPending && (
                  <Spinner className="h-4 w-4 text-white" label={t("settings.aiSaveKey")} />
                )}
                {t("settings.aiSaveKey")}
              </button>
            </div>
            {save.isError && (
              <p className="flex items-center gap-1.5 text-sm text-danger">
                <Icon name="alertTriangle" size={14} /> {errorText(aiErrorKey(save.error))}
              </p>
            )}
            {remove.isError && (
              <p className="flex items-center gap-1.5 text-sm text-danger">
                <Icon name="alertTriangle" size={14} /> {errorText(aiErrorKey(remove.error))}
              </p>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-faint">
            <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
            {t("settings.aiKeyStored")}
          </p>
        </div>
      )}
    </AccountSection>
  );
}
