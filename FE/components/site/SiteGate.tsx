"use client";

import { useEffect, useState } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useMe } from "@/hooks/useMe";
import { AuthModal } from "@/components/auth/AuthModal";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

// Applies the live site settings to the whole app. Wraps everything (inside the
// QueryClientProvider): when maintenance mode is on, non-admins get a maintenance
// screen and admins pass through with a reminder strip; an announcement shows as a
// dismissible banner. Reads the public /config, so it works for guests too.
export function SiteGate({ children }: { children: React.ReactNode }) {
  const config = useSiteConfig();
  const maintenance = config.data?.maintenanceMode ?? false;
  // Only resolve the admin flag when it actually matters (during maintenance), so
  // guests on public pages don't hit the auth-only /me the rest of the time.
  const me = useMe({ enabled: maintenance });
  const isAdmin = me.data?.isAdmin ?? false;

  if (maintenance) {
    // Wait for the admin check before deciding — don't flash the maintenance
    // screen at an admin, or the app at a non-admin.
    if (me.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-6 w-6 text-accent" />
        </div>
      );
    }
    if (!isAdmin) {
      return <MaintenanceScreen message={config.data?.maintenanceMessage ?? null} />;
    }
    // Admin: fall through to the app, with a reminder that it's in maintenance.
  }

  return (
    <>
      {maintenance && isAdmin && <MaintenanceStrip />}
      {!maintenance && config.data?.announcement && (
        <AnnouncementBanner message={config.data.announcement} />
      )}
      {children}
    </>
  );
}

function MaintenanceScreen({ message }: { message: string | null }) {
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name="settings" size={28} />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        We&apos;ll be right back
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {message || "Quizanki is down for a little maintenance. Please check back shortly."}
      </p>
      {/* An admin who isn't signed in yet needs a way in to bypass + fix things. */}
      <button
        type="button"
        onClick={() => setLoginOpen(true)}
        className="mt-2 text-xs font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
      >
        Admin log in
      </button>
      {loginOpen && (
        <AuthModal
          title="Admin sign in"
          description="Log in with an admin account to access the site during maintenance."
          initialMode="login"
          onClose={() => setLoginOpen(false)}
          onAuthed={() => setLoginOpen(false)}
        />
      )}
    </div>
  );
}

// Admin-only reminder while maintenance is on. Fixed so it doesn't disturb the
// app's full-height layout.
function MaintenanceStrip() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning/15 px-4 py-1 text-center text-[0.6875rem] font-semibold text-warning">
      <Icon name="alertTriangle" size={12} />
      Maintenance mode is ON — only admins can see the site.
    </div>
  );
}

// Site-wide announcement. Fixed at the bottom-centre so it never collides with the
// sidebar/top nav; dismissible, and re-shows if the message changes.
function AnnouncementBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [message]);
  if (dismissed) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-fit max-w-[92%] items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink shadow-card">
      <Icon name="bolt" size={14} className="shrink-0 text-accent" />
      <span className="min-w-0">{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-full p-0.5 text-muted transition hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
