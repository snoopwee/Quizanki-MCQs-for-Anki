import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { AdminReport, AdminReviewReport } from "@/types/api";

// A signed-in user flags a deck for admin review. Idempotent server-side, so a
// double-submit is harmless.
export function useReportDeck(deckId: string) {
  return useMutation({
    mutationFn: async (body: { reason: string; details: string }) => {
      await api.post(`/decks/${deckId}/report`, {
        reason: body.reason || null,
        details: body.details || null,
      });
    },
  });
}

// The admin reports queue, optionally filtered by status ("" = all).
export function useAdminReports(status: string) {
  return useQuery({
    queryKey: ["admin", "reports", status],
    queryFn: async () => {
      const { data } = await api.get<AdminReport[]>("/admin/reports", {
        params: { status: status || undefined },
      });
      return data;
    },
  });
}

// Resolve or dismiss a report. Refreshes the queue.
export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: "resolved" | "dismissed" }) => {
      await api.put(`/admin/reports/${reportId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });
}

// ── reported rating notes (a separate queue from deck reports) ───────────────

export function useAdminReviewReports(status: string) {
  return useQuery({
    queryKey: ["admin", "review-reports", status],
    queryFn: async () => {
      const { data } = await api.get<AdminReviewReport[]>("/admin/review-reports", {
        params: { status: status || undefined },
      });
      return data;
    },
  });
}

/** Resolve or dismiss. The backend notifies whoever reported it either way. */
export function useUpdateReviewReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: "resolved" | "dismissed" }) => {
      await api.put(`/admin/review-reports/${reportId}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "review-reports"] }),
  });
}

/**
 * Take the whole rating down — stars and note. Unlike the author's own delete, which only clears
 * text: the note is private and the star is public, so removing just the text would leave the
 * abuser's mark on the deck's score.
 */
export function useTakeDownRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      await api.delete(`/admin/review-reports/${reportId}/rating`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "review-reports"] });
      // A star has gone, so every surface that shows a deck's score is stale.
      queryClient.invalidateQueries({ queryKey: ["decks"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}
