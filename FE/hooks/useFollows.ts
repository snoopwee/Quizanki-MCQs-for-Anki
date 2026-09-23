import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { FollowStatusResponse, FollowedAuthorResponse } from "@/types/api";

/**
 * Whether the signed-in viewer follows this author. Personal, so it needs an account — the public
 * follower count rides on the author page response instead, where guests can see it.
 */
export function useFollowStatus(authorId: string, signedIn: boolean) {
  return useQuery({
    queryKey: ["follow", authorId],
    enabled: Boolean(authorId) && signedIn,
    queryFn: async () => {
      const { data } = await api.get<FollowStatusResponse>(`/authors/${authorId}/follow`);
      return data;
    },
  });
}

/**
 * Following and unfollowing both return the new state, so the button can render from the response
 * rather than guessing and refetching.
 */
function useFollowMutation(authorId: string, method: "put" | "delete") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } =
        method === "put"
          ? await api.put<FollowStatusResponse>(`/authors/${authorId}/follow`)
          : await api.delete<FollowStatusResponse>(`/authors/${authorId}/follow`);
      return data;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(["follow", authorId], status);
      // The author page carries the public count, and /me/following gained or lost a row.
      queryClient.invalidateQueries({ queryKey: ["author", authorId] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
}

export function useFollowAuthor(authorId: string) {
  return useFollowMutation(authorId, "put");
}

export function useUnfollowAuthor(authorId: string) {
  return useFollowMutation(authorId, "delete");
}

/** The authors you follow, newest first. */
export function useFollowing() {
  return useQuery({
    queryKey: ["following"],
    queryFn: async () => {
      const { data } = await api.get<FollowedAuthorResponse[]>("/me/following");
      return data;
    },
  });
}
