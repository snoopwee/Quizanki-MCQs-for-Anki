import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DeckHistoryPoint, DeckStatsResponse } from "@/types/api";

// Deck-level performance summary (total/seen/accuracy/weak/mastered). Backed by
// GET /decks/{id}/stats — data the answer path already maintains in card_stats.
export function useDeckStats(deckId: string) {
  return useQuery({
    queryKey: ["deck-stats", deckId],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<DeckStatsResponse>(`/decks/${deckId}/stats`);
      return data;
    },
  });
}

// Daily MCQ accuracy over the last `days` calendar days for the accuracy-over-time
// chart. Sparse — only days with answers come back (see DeckHistoryPoint).
export function useDeckStatsHistory(deckId: string, days = 30) {
  return useQuery({
    queryKey: ["deck-stats-history", deckId, days],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<DeckHistoryPoint[]>(
        `/decks/${deckId}/stats/history`,
        { params: { days } },
      );
      return data;
    },
  });
}
