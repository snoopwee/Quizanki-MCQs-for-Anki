import { useMutation } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
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
    mutationFn: async (args: { sessionId: string; noteId: string; correct: boolean }) => {
      const { data } = await api.post<RecordAnswerResponse>(
        `/sessions/${args.sessionId}/answers`,
        { noteId: args.noteId, correct: args.correct },
      );
      return data;
    },
  });
}
