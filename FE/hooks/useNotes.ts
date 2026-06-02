import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// Edit a single flashcard's field values. The deck-contents query is invalidated
// so the flashcard viewer re-renders with the saved text; the notes query is
// invalidated too so any stats-paired list stays consistent.
export function useUpdateNote(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      fields,
    }: {
      noteId: string;
      fields: Record<string, string>;
    }) => {
      const { data } = await api.patch<NoteResponse>(
        `/decks/${deckId}/notes/${noteId}`,
        { fields },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
      queryClient.invalidateQueries({ queryKey: ["notes", deckId] });
    },
  });
}
