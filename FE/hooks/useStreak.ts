import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { browserTimezone } from "@/lib/timezone";
import type { StreakResponse } from "@/types/api";

export const STREAK_KEY = ["streak"] as const;

// The signed-in user's daily study streak. Computed on the server in the browser's
// timezone (sent as `tz`), so "today" is the user's own calendar day. Only recorded quiz
// and Learn answers mark a day — deck-page flashcards never do.
export function useStreak() {
  return useQuery({
    queryKey: STREAK_KEY,
    queryFn: async () => {
      const { data } = await api.get<StreakResponse>("/me/streak", {
        params: { tz: browserTimezone() },
      });
      return data;
    },
  });
}
