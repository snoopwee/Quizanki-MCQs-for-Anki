import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { browserTimezone } from "@/lib/timezone";
import type { StreakResponse, StudyActivityRequest, StudyActivitySource } from "@/types/api";

export const STREAK_KEY = ["streak"] as const;

// The signed-in user's daily study streak. Computed on the server in the browser's
// timezone (sent as `tz`), so "today" is the user's own calendar day.
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

// Marks today as a study day for study that records no graded answer (deck-page
// flashcards). Recorded quiz / Learn answers already mark the day on the server, so they
// don't need this. Idempotent per local day.
export function useRecordStudyActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: StudyActivitySource) => {
      const body: StudyActivityRequest = { source, timezone: browserTimezone() };
      await api.post("/me/activity", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STREAK_KEY });
    },
  });
}
