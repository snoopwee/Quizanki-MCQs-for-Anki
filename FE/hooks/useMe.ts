import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { MeResponse } from "@/types/api";

// The signed-in user's identity + admin flag. Cached and rarely-changing within a
// session, so it drives the admin nav/route guard without refetching on every hop.
// The backend independently gates /api/v1/admin/** — this is only for the UI.
//
// `enabled` lets a caller (the maintenance gate) hold off the /me request until it
// actually needs the admin flag — so guests on public pages don't hit an auth-only
// endpoint unless the site is in maintenance.
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["me"],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const { data } = await api.get<MeResponse>("/me");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
