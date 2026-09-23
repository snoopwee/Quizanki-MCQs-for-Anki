import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

/**
 * Is this value the handle the viewer already holds?
 *
 * The availability endpoint is unauthenticated and cannot know who is asking, so without this
 * check it reports somebody's own handle as taken — by them. That shipped once, and turned a
 * `hoangtest` into a `hoangtest2`.
 */
export function isOwnHandle(value: string, ownHandle?: string | null): boolean {
  const own = (ownHandle ?? "").trim();
  return own.length > 0 && value.trim().toLowerCase() === own.toLowerCase();
}

type Verdict = {
  /** True only when we have a definite yes for exactly what's typed now. */
  available: boolean;
  /** Why not, when the answer is no. Null while unknown, so nothing stale is shown. */
  reason: string | null;
  /** True while the typed value is ahead of the answer. */
  checking: boolean;
};

/**
 * Is this handle free? Debounced, because it runs while somebody types.
 *
 * Deliberately unauthenticated: the sign-up form has to ask before the account exists. That has
 * one consequence worth guarding — **the endpoint has no idea who is asking**, so it reports your
 * OWN handle as taken, by you. Pass `ownHandle` and that case short-circuits to "fine" without a
 * request. Without it the prompt tells people their own name is unavailable, which is exactly how
 * a `hoangtest` ends up as `hoangtest2`.
 *
 * The answer is advisory either way: the handle is actually claimed when the profile row is
 * written, so the server still decides.
 */
export function useUsernameAvailability(
  value: string,
  enabled = true,
  ownHandle?: string | null,
): Verdict {
  const trimmed = value.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), 350);
    return () => clearTimeout(t);
  }, [trimmed]);

  const isOwn = isOwnHandle(trimmed, ownHandle);

  const query = useQuery({
    queryKey: ["usernameAvailable", debounced],
    // Below 3 characters the server would only ever say "too short", which the form already knows.
    enabled: enabled && !isOwn && debounced.length >= 3,
    // A handle can be taken between keystrokes, but not usually — one check per value is enough.
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<{ available: boolean; reason: string | null }>(
        `/public/usernames/${encodeURIComponent(debounced)}/available`,
      );
      return data;
    },
  });

  if (isOwn) {
    return { available: true, reason: null, checking: false };
  }

  const checking = query.isFetching || debounced !== trimmed;
  return {
    available: !checking && query.data?.available === true,
    // Held while a check is in flight: a stale "taken" under a name you've just fixed is worse
    // than showing nothing for a moment.
    reason: checking ? null : query.data?.reason ?? null,
    checking,
  };
}
