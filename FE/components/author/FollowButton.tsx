"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { useSession } from "@/hooks/useSession";
import { useFollowAuthor, useFollowStatus, useUnfollowAuthor } from "@/hooks/useFollows";

/**
 * Follow / Following, on a public author page.
 *
 * A guest gets the same button, and pressing it opens the sign-up modal — following is a good
 * reason to make an account, so the button asks rather than disappearing. The author sees nothing:
 * the backend refuses a self-follow, and offering a control that always fails is worse than none.
 */
export function FollowButton({ authorId, authorName }: { authorId: string; authorName: string }) {
  const { user, loading } = useSession();
  const signedIn = Boolean(user);
  const status = useFollowStatus(authorId, signedIn);
  const follow = useFollowAuthor(authorId);
  const unfollow = useUnfollowAuthor(authorId);
  const [askingToSignIn, setAskingToSignIn] = useState(false);

  // While the session resolves, render the same-sized button rather than popping one in.
  if (loading) {
    return <span aria-hidden className="h-9 w-24 animate-pulse rounded-input bg-surface-2" />;
  }

  if (signedIn && status.data?.self) {
    return null;
  }

  const following = status.data?.following ?? false;
  const busy = follow.isPending || unfollow.isPending;

  function onClick() {
    if (!signedIn) {
      setAskingToSignIn(true);
      return;
    }
    if (following) {
      unfollow.mutate();
    } else {
      follow.mutate();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={following}
        className={buttonClasses({ variant: following ? "ghost" : "primary", size: "sm" })}
      >
        {busy ? (
          <Spinner className={`h-4 w-4 ${following ? "text-muted" : "text-white"}`} label="Saving" />
        ) : (
          <Icon name={following ? "check" : "plus"} size={15} />
        )}
        {following ? "Following" : "Follow"}
      </button>

      {askingToSignIn && (
        <AuthModal
          title={`Follow ${authorName || "this author"}`}
          description="Make an account and their new decks show up in your notifications."
          onClose={() => setAskingToSignIn(false)}
          onAuthed={async () => {
            setAskingToSignIn(false);
            // The session hook picks the new user up; follow straight away so the click that
            // started this isn't lost.
            await follow.mutateAsync();
          }}
        />
      )}
    </>
  );
}
