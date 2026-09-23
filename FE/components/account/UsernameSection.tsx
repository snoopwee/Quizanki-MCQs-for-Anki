"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/hooks/useMe";
import { AccountSection } from "@/components/account/AccountSection";
import { UsernameField } from "@/components/auth/UsernameField";
import { buttonClasses } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Change your username — **the only name this app has**. It is your `/user/…` URL, the name that
 * credits your decks, and how people find you. There is deliberately no separate "display name":
 * two names meant two places to be called something, and nobody could tell which one showed where.
 *
 * Saving does three things, in this order: the server renames you and re-credits your decks; the
 * Supabase session is updated so the sidebar and your initials follow; the caches that render a
 * name are dropped. The server call is first because it is the one that can fail on a collision.
 *
 * Changing it breaks links to your OLD username, as on every site that allows this. Nothing inside
 * the app breaks: follows, decks and notifications are all keyed by your user id.
 */
export function UsernameSection() {
  const me = useMe();
  const queryClient = useQueryClient();
  const current = me.data?.username ?? "";

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Seeded from the server value, and re-seeded if it changes underneath us — the same pattern the
  // display-name field uses, so a local edit survives a refetch.
  useEffect(() => {
    setValue(current);
  }, [current]);

  const save = useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.put<{ username: string; decksUpdated: number }>("/me/username", {
        username,
      });
      // The session carries the name the sidebar and avatar initials read, and only the browser
      // client can write it. Best-effort: the rename itself is already saved server-side.
      try {
        await createClient().auth.updateUser({ data: { display_name: data.username } });
      } catch {
        /* the next page load re-reads it from the profile row anyway */
      }
      return data.username;
    },
    onSuccess: (username) => {
      setError(null);
      setSaved(username);
      // Every profile link in the app reads this, so the cache has to learn the new handle.
      queryClient.setQueryData(["me"], (old: unknown) =>
        old && typeof old === "object" ? { ...old, username } : old,
      );
      // Everything that renders a name: deck cards credit it, Discover and the author page show
      // it, and ["decks"] covers Home's saved/recent lists by prefix.
      for (const key of [["userPage"], ["author"], ["discover"], ["decks"], ["deck-contents"], ["shared-deck"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      setSaved(null);
      setError(err.response?.data?.message ?? "Couldn't save that username.");
    },
  });

  const trimmed = value.trim();
  const dirty = trimmed.length > 0 && trimmed.toLowerCase() !== current.toLowerCase();

  return (
    <AccountSection
      icon="user"
      title="Username"
      description="Your name on Quizanki: it credits your decks, and it's how people find you."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <UsernameField
            id="profile-username"
            value={value}
            // Their own handle sitting in the box is not a collision with themselves.
            ownHandle={current}
            onChange={(next) => {
              setValue(next);
              setError(null);
              setSaved(null);
            }}
            disabled={me.isLoading || save.isPending}
            label=""
            hint={
              error || saved
                ? undefined
                : "Shown on your decks. Changing it stops links to your old username from working."
            }
          />
        </div>
        <button
          type="button"
          onClick={() => save.mutate(trimmed)}
          disabled={!dirty || save.isPending}
          className={buttonClasses({ variant: "primary", size: "md", className: "sm:w-auto" })}
        >
          {save.isPending && <Spinner className="h-4 w-4 text-white" label="Saving" />}
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-sm text-success">Saved. You&apos;re now {saved}.</p>
      ) : null}
    </AccountSection>
  );
}
