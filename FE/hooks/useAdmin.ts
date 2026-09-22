import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
  AdminStatsResponse,
  AdminUsersPage,
  AnnouncementResultResponse,
  AudienceResponse,
  PublicDeckPage,
} from "@/types/api";

// A page of Supabase users (1-based), from the Admin API. keepPreviousData so the
// table doesn't blank out while paging.
export function useAdminUsers(page: number) {
  return useQuery({
    queryKey: ["admin", "users", page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<AdminUsersPage>("/admin/users", {
        params: { page, perPage: 50 },
      });
      return data;
    },
  });
}

// Ban (disable sign-in) or unban a user. Refreshes the user list.
export function useSetUserBanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      await api.put(`/admin/users/${userId}/ban`, { banned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// Site-wide totals for the admin overview dashboard.
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get<AdminStatsResponse>("/admin/stats");
      return data;
    },
  });
}

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

// ── Announcements (Phase 10 S5) ──────────────────────────────────────────────

// How many people a broadcast would reach. Asked for when the admin picks "Everyone", so the
// confirm can name a number before anything irreversible happens.
export function useAnnouncementAudience(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "announcement-audience"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<AudienceResponse>("/admin/announcements/audience");
      return data.recipients;
    },
  });
}

// Send one. On success the notification queries are invalidated too: an announcement reaches the
// sending admin as well, so their own bell should light up immediately — which is how a broadcast
// gets verified without asking a user.
export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: {
      title: string;
      body: string | null;
      link: string | null;
      audience: "all" | "me";
    }) => {
      const { data } = await api.post<AnnouncementResultResponse>("/admin/announcements", request);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
