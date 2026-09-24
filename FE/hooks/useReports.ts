import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { AdminReport, AdminReviewReport, ReportCounts } from "@/types/api";

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

/**
 * How much moderation work is waiting, for the sidebar badge and the queue tabs.
 *
 * Polled, because a report arrives from somebody else's browser — nothing here can invalidate it.
 * Slow poll: a report is not urgent to the minute, and this rides along on every admin screen.
 */
export function useReportCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "reports", "counts"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<ReportCounts>("/admin/reports/counts");
      return data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    // Admin chrome: no badge is better than an error box if this can't be had.
    retry: 1,
  });
}

// The admin reports queue, filtered by status: "" all, "open", "closed" (resolved + dismissed).
export function useAdminReports(status: string, reason: string) {
  return useQuery({
    queryKey: ["admin", "reports", status, reason],
    queryFn: async () => {
      const { data } = await api.get<AdminReport[]>("/admin/reports", {
        params: { status: status || undefined, reason: reason || undefined },
      });
      return data;
    },
  });
}

// Resolve or dismiss a report. Refreshes the queue.
export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    // `note` is required by the backend: the row is deleted fifteen days after it closes, so an
    // unexplained decision leaves nothing behind.
    mutationFn: async ({
      reportId,
      status,
      note,
    }: {
      reportId: string;
      status: "resolved" | "dismissed";
      note: string;
    }) => {
      await api.put(`/admin/reports/${reportId}`, { status, note });
    },
    onSuccess: () => {
      // Prefix match, so this refreshes the queue AND the badge.
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });
}

// ── reported rating notes (a separate queue from deck reports) ───────────────

export function useAdminReviewReports(status: string, reason: string) {
  return useQuery({
    queryKey: ["admin", "review-reports", status, reason],
    queryFn: async () => {
      const { data } = await api.get<AdminReviewReport[]>("/admin/review-reports", {
        params: { status: status || undefined, reason: reason || undefined },
      });
      return data;
    },
  });
}

/** Resolve or dismiss. The backend notifies whoever reported it either way. */
export function useUpdateReviewReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      status,
      note,
    }: {
      reportId: string;
      status: "resolved" | "dismissed";
      note: string;
    }) => {
      await api.put(`/admin/review-reports/${reportId}`, { status, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "review-reports"] });
      // The badge counts BOTH queues, and it lives under the other prefix.
      queryClient.invalidateQueries({ queryKey: ["admin", "reports", "counts"] });
    },
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
    // POST, not DELETE: this carries a reason, and that reason is sent on to the person whose
    // rating is being removed.
    mutationFn: async ({ reportId, note }: { reportId: string; note: string }) => {
      await api.post(`/admin/review-reports/${reportId}/takedown`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "review-reports"] });
      // A star has gone, so every surface that shows a deck's score is stale.
      queryClient.invalidateQueries({ queryKey: ["decks"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}
