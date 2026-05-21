import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { NoteResponse } from "@/types/api";

export interface NotesParams {
  tags?: string[];
  weakOnly?: boolean;
  limit?: number;
}

export function useNotes(deckId: string, params?: NotesParams) {
  return useQuery({
    queryKey: ["notes", deckId, params ?? {}],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<NoteResponse[]>(`/decks/${deckId}/notes`, {
        params,
        paramsSerializer: { indexes: null }, // tags=a&tags=b (repeat, no [] suffix)
      });
      return data;
    },
  });
}
