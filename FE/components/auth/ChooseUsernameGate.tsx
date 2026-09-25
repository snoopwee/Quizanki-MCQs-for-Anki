"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/hooks/useMe";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import { UsernameField } from "@/components/auth/UsernameField";
import { BrandMark } from "@/components/ui/BrandMark";
import { Spinner } from "@/components/ui/Spinner";

/**
 * "Pick your username" — shown once, to anybody whose handle we generated rather than they chose.
 *
 * That is two groups: somebody who signed in with Google (there is no form to put a field on), and
 * every account that predates handles. Both are marked `usernameChosen: false` by the backend.
 *
 * **Pre-filled with the handle they already have**, so the common answer is one click. That is the
 * difference between asking somebody to confirm their name and asking them to invent one, and it
 * is the whole reason this is tolerable in a sign-up funnel.
 *
 * Not dismissable — no close button, no escape, no backdrop click. A handle is how people find and
 * link to you, so every account gets one its owner has actually seen.
 */
export function ChooseUsernameGate() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const suggested = me.data?.username ?? "";
  const needed = me.data !== undefined && me.data.usernameChosen === false;

  useEffect(() => {
    setValue(suggested);
  }, [suggested]);

  // `suggested` is the handle they already hold, so the check knows not to call it taken.
  const check = useUsernameAvailability(value, needed, suggested);
  const unchanged = value.trim().toLowerCase() === suggested.toLowerCase();
  const ready = unchanged ? suggested.length > 0 : check.available;

  const save = useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.put<{ username: string }>("/me/username", { username });
      // One name: the session has to carry it too, or the sidebar and avatar initials keep
      // showing whatever the OAuth provider called them.
      try {
        await createClient().auth.updateUser({ data: { display_name: data.username } });
      } catch {
        /* best effort — the rename is already saved */
      }
      return data.username;
    },
    onSuccess: (username) => {
      // Flip both fields locally so the gate closes without waiting for a refetch.
      queryClient.setQueryData(["me"], (old: unknown) =>
        old && typeof old === "object" ? { ...old, username, usernameChosen: true } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["userPage"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      // The handle can be taken between the check and the claim — rare, but the claim is the only
      // authority, so its answer is the one shown.
      setError(err.response?.data?.message ?? "Couldn't save that username.");
    },
  });

  if (!needed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose your username"
        className="rise my-8 w-full max-w-[25.5rem] rounded-[18px] border border-line bg-surface p-7 shadow-card"
      >
        <BrandMark />
        <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          Pick your username
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is your name on Quizanki — it credits your decks and it&apos;s how people find you.
          We picked one to start with; keep it or change it.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate(value.trim());
          }}
        >
          <UsernameField
            id="choose-username"
            value={value}
            ownHandle={suggested}
            onChange={(next) => {
              setValue(next);
              setError(null);
            }}
            disabled={save.isPending}
            autoFocus
            label="Username"
            hint="Shown on your decks. You can change it later in your profile."
          />

          {error && (
            <p className="rounded-input border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready || save.isPending}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
          >
            {save.isPending && <Spinner className="h-4 w-4 text-white" label="Saving" />}
            {unchanged ? "Continue" : "Save username"}
          </button>
        </form>
      </div>
    </div>
  );
}
