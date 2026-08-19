import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { AdminStatsResponse, AdminUsersPage, PublicDeckPage } from "@/types/api";

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
