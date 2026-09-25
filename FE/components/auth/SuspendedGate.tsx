"use client";

import { useMe } from "@/hooks/useMe";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/icons";

/**
 * What a suspended account sees instead of the app.
 *
 * This screen is the reason suspensions live in our own database rather than at Supabase: their
 * ban blocks sign-in outright, and with no session there is no way to know who is asking, so the
 * reason could never be shown. Here they sign in normally, `GET /me` reports the suspension, and
 * every other request is refused by the backend.
 *
 * Undismissable by design — no close, no escape, no backdrop. There is nothing behind it they are
 * allowed to do, and a dismissable overlay would just reveal an app that answers 403 to everything.
 */
export function SuspendedGate() {
  const me = useMe();
  const suspension = me.data?.suspension;

  if (!suspension) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your account is suspended"
        className="rise my-8 w-full max-w-[28rem] rounded-[18px] border border-line bg-surface p-7 shadow-card"
      >
        <BrandMark />

        <div className="mt-5 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-input bg-danger/10 text-danger">
            <Icon name="alertTriangle" size={18} />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            Your account is suspended
          </h2>
        </div>

        {/* The admin's words, verbatim. Paraphrasing a moderation decision helps nobody, and a
            person who was suspended by mistake needs the actual grounds to appeal. */}
        <blockquote className="mt-4 whitespace-pre-wrap break-words rounded-input border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink">
          {suspension.reason}
        </blockquote>

        {suspension.bannedAt && (
          <p className="mt-2 font-mono text-xs text-faint">
            Suspended {formatWhen(suspension.bannedAt)}
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted">
          You can&apos;t study, import or share while this is in place. Your decks are untouched.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If you think this is a mistake, reply to the email you signed up with and an admin will
          take another look.
        </p>
      </div>
    </div>
  );
}

/** Just the date — "suspended 3 minutes ago" invites a refresh that will change nothing. */
function formatWhen(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(when);
}
