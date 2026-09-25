import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { browserTimezone } from "@/lib/timezone";
import type { AiDeckDraftResponse, AiKeyStatusResponse } from "@/types/api";

export const AI_KEY_STATUS_KEY = ["ai-key"] as const;

/** Whether this account has its own provider key stored. Never returns the key. */
export function useAiKeyStatus() {
  return useQuery({
    queryKey: AI_KEY_STATUS_KEY,
    queryFn: async () => {
      const { data } = await api.get<AiKeyStatusResponse>("/me/ai-key");
      return data;
    },
  });
}

export function useSaveAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const { data } = await api.put<AiKeyStatusResponse>("/me/ai-key", { provider, apiKey });
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(AI_KEY_STATUS_KEY, data),
  });
}

export function useDeleteAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete("/me/ai-key");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_KEY_STATUS_KEY }),
  });
}

/**
 * Generation is slow by nature — the server may make several provider calls in one request — so
 * both mutations below raise the client timeout well above the axios default. Nothing is saved by
 * these: the response is a draft for the review editor.
 */
const GENERATION_TIMEOUT_MS = 120_000;

export function useGenerateDeckFromText() {
  return useMutation({
    mutationFn: async (input: { text: string; deckName?: string; maxCards?: number }) => {
      const { data } = await api.post<AiDeckDraftResponse>(
        "/ai/decks/draft",
        { ...input, timezone: browserTimezone() },
        { timeout: GENERATION_TIMEOUT_MS },
      );
      return data;
    },
  });
}

export function useGenerateDeckFromPdf() {
  return useMutation({
    mutationFn: async (input: { file: File; deckName?: string; maxCards?: number }) => {
      const form = new FormData();
      form.append("file", input.file);
      if (input.deckName) form.append("deckName", input.deckName);
      if (input.maxCards) form.append("maxCards", String(input.maxCards));
      // browserTimezone() is undefined where Intl isn't available; the backend then falls back
      // to UTC, which is exactly what omitting the field does.
      const tz = browserTimezone();
      if (tz) form.append("tz", tz);

      const { data } = await api.post<AiDeckDraftResponse>("/ai/decks/draft/pdf", form, {
        timeout: GENERATION_TIMEOUT_MS,
      });
      return data;
    },
  });
}
