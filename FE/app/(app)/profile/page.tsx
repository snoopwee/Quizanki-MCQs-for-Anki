"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/hooks/useSession";
import { useDecks } from "@/hooks/useDecks";
import { useMe } from "@/hooks/useMe";
import { profileUrl } from "@/lib/profileUrl";
import { avatarUrlOf, displayNameOf, hasCustomAvatar, initialsFrom } from "@/lib/userDisplay";
import { AccountSection } from "@/components/account/AccountSection";
import { UsernameSection } from "@/components/account/UsernameSection";
import { AvatarUploadModal } from "@/components/account/AvatarUploadModal";
import { Avatar } from "@/components/ui/Avatar";
import { Toast } from "@/components/shared/Toast";
import { Icon } from "@/components/ui/icons";

function formatJoined(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }).format(d);
}

export default function ProfilePage() {
  const { user, loading } = useSession();
  const decksQuery = useDecks();
  const me = useMe();

  const storedName = displayNameOf(user);
  const email = user?.email ?? "";
  const avatarUrl = avatarUrlOf(user);
  // Only our uploaded avatar is removable (the OAuth default isn't ours to clear).
  const hasUploadedAvatar = hasCustomAvatar(user);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const joined = formatJoined(user?.created_at);
  const verified = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
  // One name: the username. `storedName` mirrors it (the rename writes both), so initials and the
  // header keep working off the session without a second request.
  const avatar = useMemo(() => initialsFrom(storedName, email), [storedName, email]);

  if (loading) {
    return <p className="text-sm text-muted">Loading profile…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted">Your account identity across Quizanki.</p>
      </header>

      {/* identity summary */}
      <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5">
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} initials={avatar} className="h-16 w-16 text-xl" />
          {/* Edit badge sits on the avatar's border and opens the picker modal. */}
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="Change profile picture"
            title="Change profile picture"
            className="focus-ring absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-accent text-white shadow-btn transition hover:opacity-90"
          >
            <Icon name="pencil" size={13} />
          </button>
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {me.data?.username || storedName || "Unnamed learner"}
          </p>
          <p className="truncate text-sm text-muted">{email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
            {joined && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" size={13} /> Joined {joined}
              </span>
            )}
            {!decksQuery.isLoading && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="layers" size={13} /> {decksQuery.data?.length ?? 0} deck
                {(decksQuery.data?.length ?? 0) === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Followers and Following live on the public page, which is the one other people see —
          this page is account settings. A link keeps them one click away. */}
      {user && (
        <Link
          href={profileUrl(user.id, me.data?.username)}
          className="focus-ring flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition hover:border-line-strong"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-ink">
            <Icon name="user" size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Your public page</span>
            <span className="block text-xs text-muted">
              {me.data?.username
                ? `quizanki.app/user/${me.data.username}`
                : "Your decks as other people see them, plus your followers and who you follow."}
            </span>
          </span>
          <Icon name="chevronRight" size={15} className="shrink-0 text-faint" />
        </Link>
      )}

      <UsernameSection />

      {/* email (read-only in v1) */}
      <AccountSection
        icon="mail"
        title="Email"
        description="Used to sign in. Changing your email isn't available yet."
      >
        <div className="flex items-center justify-between gap-3 rounded-input border border-line bg-surface-2 px-3 py-2.5">
          <span className="min-w-0 truncate text-sm text-ink">{email}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
              verified
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            {verified ? <Icon name="check" size={12} /> : <Icon name="alertTriangle" size={12} />}
            {verified ? "Verified" : "Unverified"}
          </span>
        </div>
      </AccountSection>

      {photoOpen && user && (
        <AvatarUploadModal
          currentUrl={avatarUrl}
          initials={avatar}
          displayName={storedName}
          canRemove={hasUploadedAvatar}
          onClose={() => setPhotoOpen(false)}
          onResult={(kind, message) => setToast({ kind, message })}
        />
      )}

      {toast && (
        <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
