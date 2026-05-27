import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DeckContentsResponse, DeckResponse, ImportDeckRequest } from "@/types/api";

const DECKS_KEY = ["decks"] as const;

export function useDecks() {
  return useQuery({
    queryKey: DECKS_KEY,
    queryFn: async () => {
      const { data } = await api.get<DeckResponse[]>("/decks");
      return data;
    },
  });
}

export function useDeckContents(deckId: string) {
  return useQuery({
    queryKey: ["deck-contents", deckId],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<DeckContentsResponse>(`/decks/${deckId}/contents`);
      return data;
    },
  });
}

export function useImportDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ImportDeckRequest) => {
      const { data } = await api.post<DeckResponse>("/decks", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.delete(`/decks/${deckId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}
