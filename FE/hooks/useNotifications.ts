import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { NotificationPageResponse, UnreadCountResponse } from "@/types/api";

export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** How often the closed bell re-checks. Long enough to be free, short enough to feel live. */
const BADGE_POLL_MS = 30_000;

/**
 * The badge number. This runs on every page (the bell is chrome), so it asks for a count and
 * nothing else; the panel's own query fetches the rows.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "unread"],
    queryFn: async () => {
      const { data } = await api.get<UnreadCountResponse>("/me/notifications/unread-count");
      return data.unread;
    },
    refetchInterval: BADGE_POLL_MS,
    // React Query pauses the interval while the tab is hidden — sensible, but it means someone
    // coming back to a background tab would sit on a stale badge until the next tick. The app-wide
    // default is refetchOnWindowFocus: false (app/providers.tsx); a badge is exactly the thing that
    // should be true the moment you look at it, so this query opts back in. staleTime: 0 is part of
    // that: with the global 60s staleTime the focus refetch would be skipped as "still fresh".
    refetchOnWindowFocus: true,
    staleTime: 0,
    // The bell is chrome on every screen: if the count can't be had, fail fast and quietly rather
    // than hammering a route that (on an older backend) doesn't exist yet. No badge, no error UI.
    retry: 1,
  });
}

/**
 * One page of rows, fetched only while the panel is open — a closed bell shouldn't pull a list
 * nobody is looking at. The response carries the unread count too, so opening costs one request.
 */
export function useNotifications(open: boolean) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "page"],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get<NotificationPageResponse>("/me/notifications", {
        params: { limit: 20 },
      });
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/me/notifications/${notificationId}/read`);
    },
    // Invalidating the prefix refreshes both the badge and the open panel.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/me/notifications/read-all");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.delete(`/me/notifications/${notificationId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

/** Empties the caller's own bell — read and unread alike. No undo, so the UI confirms first. */
export function useClearNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete("/me/notifications");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
