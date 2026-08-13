"use client";

import { useState, type FormEvent } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useTextSize } from "@/hooks/useTextSize";
import { createClient } from "@/lib/supabase/client";
import { AccountSection, accountInputClasses } from "@/components/account/AccountSection";
import { Toast } from "@/components/shared/Toast";
import { Segmented, Slider, SoonTag } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import SignOutButton from "../SignOutButton";
import type { ThemePref } from "@/lib/theme";
import {
  TEXT_SIZE_DEFAULT,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TEXT_SIZE_STEP,
} from "@/lib/textSize";

const MIN_PASSWORD = 8;

export default function SettingsPage() {
  const { pref, resolved, setPref } = useTheme();
  const { size: textSize, setSize: setTextSize } = useTextSize();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.length < MIN_PASSWORD) {
      setPwError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (pw !== confirm) {
      setPwError("The two passwords don't match.");
      return;
    }
    setSavingPw(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) {
      // Supabase surfaces "same as old", "needs recent login", etc. here.
      setPwError(error.message || "Couldn't update your password.");
      return;
    }
    setPw("");
    setConfirm("");
    setToast({ kind: "success", message: "Password updated." });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">Appearance, account security, and more.</p>
      </header>

      {/* appearance / theme */}
      <AccountSection
        icon="palette"
        title="Appearance"
        description={
          pref === "system"
            ? `Following your system theme — currently ${resolved}.`
            : "Choose how Quizanki looks on this device."
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Theme</p>
            <Segmented<ThemePref>
              value={pref}
              onChange={setPref}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted">Text size</p>
              <button
                type="button"
                onClick={() => setTextSize(TEXT_SIZE_DEFAULT)}
                disabled={textSize === TEXT_SIZE_DEFAULT}
                className="text-xs font-medium text-accent transition hover:opacity-80 disabled:opacity-40"
              >
                Reset
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
            <p className="mt-2 text-xs text-faint">
              Drag to make the text bigger across the whole app.
            </p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Icon name={resolved === "dark" ? "moon" : "sun"} size={13} />
          Saved to this browser only.
        </p>
      </AccountSection>

      {/* change password */}
      <AccountSection
        icon="lock"
        title="Password"
        description="Set a new password. You'll stay signed in on this device."
      >
        <form onSubmit={changePassword} className="space-y-3">
          {/* Username hint for password managers; not shown. */}
          <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden tabIndex={-1} />
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-xs font-medium text-muted">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters`}
              className={accountInputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-muted">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter the password"
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
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </AccountSection>

      {/* danger zone */}
      <AccountSection
        icon="alertTriangle"
        title="Account"
        tone="danger"
        description="Sign out on this device, or delete your account and all its decks."
      >
        <div className="space-y-4">
          <div>
            <SignOutButton />
          </div>
          <div className="flex flex-col gap-2 rounded-input border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                Delete account <SoonTag />
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Permanently removes your account and every deck. Not available yet — coming soon.
              </p>
            </div>
            <button
              type="button"
              disabled
              className={buttonClasses({ variant: "danger", size: "sm", className: "shrink-0" })}
            >
              <Icon name="trash" size={15} /> Delete account
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
