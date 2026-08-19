import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { SiteConfig } from "@/types/api";

// The live site settings — PUBLIC, read on load by every client (guest included) to
// apply maintenance mode + the announcement banner. Refetches on focus so toggling
// maintenance reaches already-open tabs when they're next looked at.
export function useSiteConfig() {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data } = await api.get<SiteConfig>("/public/config");
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// Admin write. Pushes the returned settings straight into the cache so the change
// takes effect immediately (maintenance / banner) without a reload.
export function useUpdateSiteConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: SiteConfig) => {
      const { data } = await api.put<SiteConfig>("/admin/config", config);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["site-config"], data);
    },
  });
}
