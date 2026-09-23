"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import { useMe } from "@/hooks/useMe";
import { AccountSection, accountInputClasses } from "@/components/account/AccountSection";
import { buttonClasses } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Your public handle — the `/user/{username}` half of your profile URL.
 *
 * It arrives already filled in: a handle is generated from your display name the first time the
 * backend sees you, because making somebody invent one mid-signup is a worse first minute than
 * letting them change it later. This is the "later".
 *
 * Changing it breaks links to the old handle, which is true of every site that allows this and is
 * why the warning is stated plainly rather than hidden behind a confirm dialog. Nothing INSIDE the
 * app breaks: follows, decks and notifications are all keyed by the user id.
 */
export function UsernameSection() {
  const me = useMe();
  const queryClient = useQueryClient();
  const current = me.data?.username ?? "";

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seeded from the server value, and re-seeded if it changes underneath us — the same pattern the
  // display-name field uses, so a local edit survives a refetch.
  useEffect(() => {
    setValue(current);
  }, [current]);

  const save = useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.put<{ username: string }>("/me/username", { username });
      return data.username;
    },
    onSuccess: (username) => {
      setError(null);
      setSaved(true);
      // Every profile link in the app reads this, so the cache has to learn the new handle.
      queryClient.setQueryData(["me"], (old: unknown) =>
        old && typeof old === "object" ? { ...old, username } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["userPage"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      setSaved(false);
      setError(err.response?.data?.message ?? "Couldn't save that username.");
    },
  });

  const trimmed = value.trim();
  const dirty = trimmed !== current && trimmed.length > 0;

  return (
    <AccountSection
      icon="link"
      title="Username"
      description="The address of your public page. People see this instead of a long id."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-1 items-center gap-0 rounded-input border border-line-strong bg-surface-2 pl-3">
          <span className="shrink-0 select-none font-mono text-sm text-faint">/user/</span>
          <input
            type="text"
            value={value}
            maxLength={30}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSaved(false);
            }}
            placeholder={me.isLoading ? "" : "your-handle"}
            className={`${accountInputClasses} border-0 bg-transparent pl-0 font-mono focus-visible:outline-none`}
          />
        </span>
        <button
          type="button"
          onClick={() => save.mutate(trimmed)}
          disabled={!dirty || save.isPending}
          className={buttonClasses({ variant: "primary", size: "md", className: "sm:w-auto" })}
        >
          {save.isPending ? <Spinner className="h-4 w-4 text-white" label="Saving" /> : null}
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-sm text-success">Saved. Your page is now /user/{current}.</p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Letters, numbers, and <span className="font-mono">. _ -</span> — 3 to 30 characters.
          Changing it stops old links to your old handle from working.
        </p>
      )}
    </AccountSection>
  );
}
