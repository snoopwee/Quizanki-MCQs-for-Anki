import { useMutation, type QueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { browserTimezone } from "@/lib/timezone";
import type {
  AnswerSource,
  RecordAnswerRequest,
  RecordAnswerResponse,
  StartSessionRequest,
  StartSessionResponse,
} from "@/types/api";

export function useStartSession() {
  return useMutation({
    mutationFn: async (request: StartSessionRequest) => {
      const { data } = await api.post<StartSessionResponse>("/sessions", request);
      return data;
    },
  });
}

export function useRecordAnswer() {
  return useMutation({
    mutationFn: async (args: {
      sessionId: string;
      noteId: string;
      correct: boolean;
      // Required, so every caller has to say which study surface the answer came from.
      source: AnswerSource;
    }) => {
      const body: RecordAnswerRequest = {
        noteId: args.noteId,
        correct: args.correct,
        source: args.source,
        // Files today's study day under the user's own date for the streak.
        timezone: browserTimezone(),
      };
      const { data } = await api.post<RecordAnswerResponse>(
        `/sessions/${args.sessionId}/answers`,
        body,
      );
      return data;
    },
  });
}

// Everything a recorded answer changes. Call it from the record call's onSuccess on any
// surface that records answers (the quiz, Learn), so they all refresh the same screens.
export function invalidateAfterAnswer(queryClient: QueryClient) {
  // The server is the source of truth for mastery: the next "set up a quiz" and the Home
  // completion % pick up the new values.
  queryClient.invalidateQueries({ queryKey: ["notes"] });
  queryClient.invalidateQueries({ queryKey: ["decks"] });
  queryClient.invalidateQueries({ queryKey: ["deck-contents"] });
  // The deck's Progress panel (tiles + accuracy-over-time chart).
  queryClient.invalidateQueries({ queryKey: ["deck-stats"] });
  queryClient.invalidateQueries({ queryKey: ["deck-stats-history"] });
  // A recorded answer marks today a study day, so the Home streak changes.
  queryClient.invalidateQueries({ queryKey: ["streak"] });
}
