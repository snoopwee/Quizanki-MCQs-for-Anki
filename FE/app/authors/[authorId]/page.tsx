"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthorPage } from "@/hooks/useDecks";
import { AppChrome } from "@/components/layout/AppChrome";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";

/**
 * The old profile URL, kept forever as an alias for `/user/{username}`.
 *
 * Handles are changeable, so they can't be the thing links are stored against. The user id can't
 * change, so anything we persist — a notification's link, a share someone pasted into a chat a year
 * ago — points here, and here redirects to whatever that person is called today.
 *
 * `replace`, not `push`: the alias shouldn't sit in history as a page you can go "back" to.
 */
export default function AuthorAliasPage() {
  const { authorId } = useParams<{ authorId: string }>();
  const router = useRouter();
  const query = useAuthorPage(authorId);
  const username = query.data?.username;

  useEffect(() => {
    if (username) {
      router.replace(`/user/${encodeURIComponent(username)}`);
    }
  }, [username, router]);

  return (
    <AppChrome>
      <div className="mx-auto max-w-5xl">
        {query.isError ? (
          <Card className="p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-input bg-surface-2 text-muted">
              <Icon name="user" size={24} />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">We couldn&apos;t find that person</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              The link may be wrong, or the account may be gone.
            </p>
            <Link
              href="/discover"
              className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
            >
              Browse Discover
            </Link>
          </Card>
        ) : (
          // A profile with no handle yet can't be redirected, so it renders nothing rather than
          // bouncing to a broken URL. The next GET /me assigns one.
          <p className="text-sm text-muted">Taking you to their page…</p>
        )}
      </div>
    </AppChrome>
  );
}
