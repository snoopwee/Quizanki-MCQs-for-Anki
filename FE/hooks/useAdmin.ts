import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { PublicDeckPage } from "@/types/api";

export interface AdminDecksParams {
  q: string;
  page: number; // zero-based
  pageSize: number;
}

// The moderation catalogue — every public deck. Same shape as Discover, behind the
// admin gate. keepPreviousData so paging/searching doesn't flash an empty table.
export function useAdminDecks(params: AdminDecksParams) {
  return useQuery({
    queryKey: ["admin", "decks", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<PublicDeckPage>("/admin/decks", {
        params: {
          q: params.q || undefined,
          limit: params.pageSize,
          offset: params.page * params.pageSize,
        },
      });
      return data;
    },
  });
}

// Take a deck off Discover (owner keeps it). Refreshes the moderation list and the
// public Discover catalogue so both reflect the change immediately.
export function useAdminUnpublishDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.post(`/admin/decks/${deckId}/unpublish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "decks"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}

// Delete a deck outright (spam/abuse). Cascades to its notes and everyone's
// progress — the heavy action, always behind a confirm in the UI.
export function useAdminDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.delete(`/admin/decks/${deckId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "decks"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}
