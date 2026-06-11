import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { NoteResponse } from "@/types/api";

export interface NotesParams {
  tags?: string[];
  weakOnly?: boolean;
  starredOnly?: boolean;
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

// Star / unstar a single flashcard. Optimistically patches every cached notes
// list for this deck so the star fills instantly (mid-quiz the getStats lookup
// reads from this cache), rolling back on error. Settles by invalidating notes
// and deck-contents so the server value wins.
export function useToggleStar(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, starred }: { noteId: string; starred: boolean }) => {
      const { data } = await api.put<NoteResponse>(
        `/decks/${deckId}/notes/${noteId}/star`,
        { starred },
      );
      return data;
    },
    onMutate: async ({ noteId, starred }) => {
      await queryClient.cancelQueries({ queryKey: ["notes", deckId] });
      const previous = queryClient.getQueriesData<NoteResponse[]>({
        queryKey: ["notes", deckId],
      });
      for (const [key, notes] of previous) {
        if (!notes) continue;
        queryClient.setQueryData<NoteResponse[]>(
          key,
          notes.map((n) =>
            n.id === noteId ? { ...n, cardStats: patchStarred(n.cardStats, starred) } : n,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      for (const [key, notes] of context?.previous ?? []) {
        queryClient.setQueryData(key, notes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", deckId] });
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
    },
  });
}

// Flip `starred` on a note's stats, synthesizing a zeroed stats object for a
// card that has never been answered (so the optimistic update has somewhere to
// write). Mirrors the BE, which creates a default card_stats row on first star.
function patchStarred(
  stats: NoteResponse["cardStats"],
  starred: boolean,
): NoteResponse["cardStats"] {
  if (stats) return { ...stats, starred };
  return {
    timesSeen: 0,
    timesCorrect: 0,
    accuracy: 0,
    streak: 0,
    mastery: 0,
    starred,
    lastSeenAt: null,
  };
}
