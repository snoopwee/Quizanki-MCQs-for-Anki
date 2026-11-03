"use client";

import { useState, type FormEvent } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useTextSize } from "@/hooks/useTextSize";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD, validateNewPasswordKey } from "@/lib/passwordReset";
import { AccountSection, accountInputClasses } from "@/components/account/AccountSection";
import { AiKeySection } from "@/components/settings/AiKeySection";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { Toast } from "@/components/shared/Toast";
import { Segmented, Slider, SoonTag } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import SignOutButton from "../SignOutButton";
import type { ThemePref } from "@/lib/theme";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/locale";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import {
  TEXT_SIZE_DEFAULT,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TEXT_SIZE_STEP,
} from "@/lib/textSize";


export default function SettingsPage() {
  const { pref, resolved, setPref } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const { size: textSize, setSize: setTextSize } = useTextSize();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    // Shared with the reset page, so the two places that set a password cannot drift apart.
    const problem = validateNewPasswordKey(pw, confirm);
    if (problem) {
      setPwError(t(problem.key, problem.vars));
      return;
    }
    setSavingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) {
      // Supabase surfaces "same as old", "needs recent login", etc. here.
      setPwError(error.message || t("settings.passwordUpdateFailed"));
      return;
    }
    setPw("");
    setConfirm("");
    setToast({ kind: "success", message: t("settings.passwordUpdated") });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {t("settings.heading")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("settings.lede")}</p>
      </header>

      {/* appearance / theme */}
      <AccountSection
        icon="palette"
        title={t("settings.appearance")}
        description={
          pref === "system"
            ? // A whole sentence per theme rather than splicing the word in: the adjective moves.
              t(resolved === "dark" ? "settings.followingSystemDark" : "settings.followingSystemLight")
            : t("settings.appearanceDesc")
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{t("settings.theme")}</p>
            <Segmented<ThemePref>
              value={pref}
              onChange={setPref}
              options={[
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
                { value: "system", label: t("settings.themeSystem") },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted">{t("settings.textSize")}</p>
              <button
                type="button"
                onClick={() => setTextSize(TEXT_SIZE_DEFAULT)}
                disabled={textSize === TEXT_SIZE_DEFAULT}
                className="text-xs font-medium text-accent transition hover:opacity-80 disabled:opacity-40"
              >
                {t("common.reset")}
              </button>
            </div>
            <Slider
              value={textSize}
              min={TEXT_SIZE_MIN}
              max={TEXT_SIZE_MAX}
              step={TEXT_SIZE_STEP}
              onChange={setTextSize}
              format={(v) => `${v}%`}
            />
            <p className="mt-2 text-xs text-faint">{t("settings.textSizeHint")}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{t("settings.language")}</p>
            {/* Each language is named IN that language — "Vietnamese" is no help to somebody who
                cannot read English, which is exactly who this control is for. */}
            <Segmented<Locale>
              value={locale}
              onChange={setLocale}
              options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
            />
            <p className="mt-2 text-xs text-faint">{t("settings.languageHint")}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Icon name={resolved === "dark" ? "moon" : "sun"} size={13} />
          {t("settings.savedThisBrowser")}
        </p>
      </AccountSection>

      {/* AI generation + bring-your-own-key */}
      <NotificationSettingsSection />

      <AiKeySection />

      {/* change password */}
      <AccountSection
        icon="lock"
        title={t("settings.password")}
        description={t("settings.passwordDesc")}
      >
        <form onSubmit={changePassword} className="space-y-3">
          {/* Username hint for password managers; not shown. */}
          <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden tabIndex={-1} />
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-xs font-medium text-muted">
              {t("settings.newPassword")}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t("settings.passwordPlaceholder", { count: MIN_PASSWORD })}
              className={accountInputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-muted">
              {t("settings.confirmPassword")}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("settings.confirmPlaceholder")}
              className={accountInputClasses}
            />
          </div>
          {pwError && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alertTriangle" size={14} /> {pwError}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPw || !pw || !confirm}
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            {savingPw ? t("settings.updating") : t("settings.updatePassword")}
          </button>
        </form>
      </AccountSection>

      {/* danger zone */}
      <AccountSection
        icon="alertTriangle"
        title={t("settings.account")}
        tone="danger"
        description={t("settings.accountDesc")}
      >
        <div className="space-y-4">
          <div>
            <SignOutButton />
          </div>
          <div className="flex flex-col gap-2 rounded-input border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {t("settings.deleteAccount")} <SoonTag />
              </p>
              <p className="mt-0.5 text-xs text-muted">{t("settings.deleteAccountDesc")}</p>
            </div>
            <button
              type="button"
              disabled
              className={buttonClasses({ variant: "danger", size: "sm", className: "shrink-0" })}
            >
              <Icon name="trash" size={15} /> {t("settings.deleteAccount")}
            </button>
          </div>
        </div>
      </AccountSection>

      {toast && (
        <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
