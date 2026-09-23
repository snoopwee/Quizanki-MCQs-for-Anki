import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { NotificationSettingResponse } from "@/types/api";

const KEY = ["notification-settings"] as const;

/** The kinds this person may switch off, and whether they have. */
export function useNotificationSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data } = await api.get<NotificationSettingResponse[]>("/me/notification-settings");
      return data;
    },
  });
}

export function useSetNotificationMuted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, muted }: { kind: string; muted: boolean }) => {
      await api.put(`/me/notification-settings/${kind}`, { muted });
    },
    // Optimistic: a toggle that waits for a round trip before moving feels broken. On failure the
    // refetch below puts it back where it really is.
    onMutate: async ({ kind, muted }) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<NotificationSettingResponse[]>(KEY);
      queryClient.setQueryData<NotificationSettingResponse[]>(KEY, (current) =>
        (current ?? []).map((setting) =>
          setting.kind === kind ? { ...setting, muted } : setting,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
