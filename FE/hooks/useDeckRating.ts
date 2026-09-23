import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DeckFeedbackResponse, DeckRatingResponse } from "@/types/api";

/**
 * A rating changes the deck's public score, so everything that shows a deck is stale afterwards:
 * the deck itself, Home's lists, and Discover.
 */
function invalidateAfterRating(queryClient: ReturnType<typeof useQueryClient>, deckId: string) {
  queryClient.invalidateQueries({ queryKey: ["deck-rating", deckId] });
  queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
  queryClient.invalidateQueries({ queryKey: ["decks"] });
  queryClient.invalidateQueries({ queryKey: ["discover"] });
}

/** This deck's score and the caller's own rating. Signed-in only, so guests skip it. */
export function useDeckRating(deckId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["deck-rating", deckId],
    enabled: Boolean(deckId) && enabled,
    queryFn: async () => {
      const { data } = await api.get<DeckRatingResponse>(`/decks/${deckId}/rating`);
      return data;
    },
  });
}

export function useRateDeck(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stars, note }: { stars: number; note: string | null }) => {
      const { data } = await api.put<DeckRatingResponse>(`/decks/${deckId}/rating`, { stars, note });
      return data;
    },
    onSuccess: () => invalidateAfterRating(queryClient, deckId),
  });
}

export function useRemoveDeckRating(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<DeckRatingResponse>(`/decks/${deckId}/rating`);
      return data;
    },
    onSuccess: () => invalidateAfterRating(queryClient, deckId),
  });
}

/** Every note left on a deck — author only; anyone else gets a 404 from the backend. */
export function useDeckFeedback(deckId: string) {
  return useQuery({
    queryKey: ["deck-feedback", deckId],
    queryFn: async () => {
      const { data } = await api.get<DeckFeedbackResponse>(`/decks/${deckId}/rating/notes`);
      return data;
    },
  });
}

/** Clears the note's text. The rating it came with stands — the backend enforces that. */
export function useDeleteFeedbackNote(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      await api.delete(`/decks/${deckId}/rating/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deck-feedback", deckId] });
      // The author's "N waiting" button reads this.
      queryClient.invalidateQueries({ queryKey: ["deck-rating", deckId] });
    },
  });
}

/**
 * Escalate a note to an admin. The reported text is copied server-side, so the author can delete
 * the note afterwards and the report still shows what it was about.
 */
export function useReportNote(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      reason,
      details,
    }: {
      noteId: string;
      reason: string;
      details: string;
    }) => {
      await api.post(`/decks/${deckId}/rating/notes/${noteId}/report`, {
        reason: reason || null,
        details: details || null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deck-feedback", deckId] }),
  });
}
