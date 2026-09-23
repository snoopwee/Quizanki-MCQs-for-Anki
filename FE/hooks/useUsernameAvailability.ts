import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export type UsernameCheck = {
  available: boolean;
  reason: string | null;
};

/**
 * Is this handle free? Debounced, because it runs while somebody types.
 *
 * Deliberately unauthenticated: the sign-up form has to ask before the account exists. The answer
 * is advisory — the handle is actually claimed when the profile row is written, so the server
 * still decides, and a race just means the sign-up prompt appears.
 */
export function useUsernameAvailability(value: string, enabled = true) {
  const trimmed = value.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), 350);
    return () => clearTimeout(t);
  }, [trimmed]);

  const query = useQuery({
    queryKey: ["usernameAvailable", debounced],
    // Below 3 characters the server would only ever say "too short", which the form already knows.
    enabled: enabled && debounced.length >= 3,
    // A handle can be taken between keystrokes, but not usually — one check per value is enough.
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<UsernameCheck>(
        `/public/usernames/${encodeURIComponent(debounced)}/available`,
      );
      return data;
    },
  });

  return {
    ...query,
    // True while the typed value is still ahead of the answer, so the form can hold its verdict
    // rather than flashing "available" for a handle nobody has checked yet.
    checking: query.isFetching || debounced !== trimmed,
    value: debounced,
  };
}
