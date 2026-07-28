"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { useDecks } from "@/hooks/useDecks";
import api from "@/lib/axios";
import { createClient } from "@/lib/supabase/client";
import { avatarUrlOf, displayNameOf, hasCustomAvatar, initialsFrom } from "@/lib/userDisplay";
import { AccountSection, accountInputClasses } from "@/components/account/AccountSection";
import { AvatarUploadModal } from "@/components/account/AvatarUploadModal";
import { Avatar } from "@/components/ui/Avatar";
import { Toast } from "@/components/shared/Toast";
import { buttonClasses } from "@/components/ui/Button";
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
  const queryClient = useQueryClient();

  const storedName = displayNameOf(user);
  const email = user?.email ?? "";
  const avatarUrl = avatarUrlOf(user);
  // Only our uploaded avatar is removable (the OAuth default isn't ours to clear).
  const hasUploadedAvatar = hasCustomAvatar(user);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Seed the field once the session resolves. Keyed on the stored value so an
  // external change (or the post-save refresh) re-syncs, but local edits persist.
  useEffect(() => {
    setName(storedName);
  }, [storedName]);

  const dirty = name.trim() !== storedName.trim();
  const joined = formatJoined(user?.created_at);
  const verified = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
  const avatar = useMemo(() => initialsFrom(name || storedName, email), [name, storedName, email]);

  async function saveName() {
    const next = name.trim();
    setSaving(true);
    setToast(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { display_name: next } });
    if (error) {
      setSaving(false);
      setToast({ kind: "error", message: error.message || "Couldn't save your name." });
      return;
    }

    // Deck author names are stored snapshots (there's no user table), so a rename
    // must be pushed onto the decks this user authored — otherwise old decks (and
    // Discover / shared pages) keep showing the old name. We send the new name
    // explicitly so it applies even before the JWT refreshes; refreshing the
    // session first also fixes the "cleared name" case server-side.
    try {
      await supabase.auth.refreshSession();
      await api.put("/me/author-name", { name: next });
      // Drop caches that render the author name so it updates without a reload.
      queryClient.invalidateQueries({ queryKey: ["deck-contents"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
      queryClient.invalidateQueries({ queryKey: ["shared-deck"] });
    } catch {
      // The name itself is saved; propagation is best-effort and self-heals on the
      // next rename, so don't surface this as a failure.
    }

    setSaving(false);
    setToast({ kind: "success", message: "Profile updated." });
  }

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
            {storedName || "Unnamed learner"}
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

      {/* display name */}
      <AccountSection
        icon="user"
        title="Display name"
        description="Shown on your account. This doesn't change how you sign in."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a display name"
            className={accountInputClasses}
          />
          <button
            type="button"
            onClick={saveName}
            disabled={!dirty || saving}
            className={buttonClasses({ variant: "primary", size: "md", className: "sm:w-auto" })}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </AccountSection>

      {/* email (read-only in v1) */}
      <AccountSection
        icon="mail"
        title="Email"
        description="Used to sign in. Changing your email isn't available yet."
      >
        <div className="flex items-center justify-between gap-3 rounded-input border border-line bg-surface-2 px-3 py-2.5">
          <span className="min-w-0 truncate text-sm text-ink">{email}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
