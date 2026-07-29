import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { MeResponse } from "@/types/api";

// The signed-in user's identity + admin flag. Cached and rarely-changing within a
// session, so it drives the admin nav/route guard without refetching on every hop.
// The backend independently gates /api/v1/admin/** — this is only for the UI.
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<MeResponse>("/me");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
