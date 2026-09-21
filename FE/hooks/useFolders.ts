import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { FolderDetailResponse, FolderResponse } from "@/types/api";

export const FOLDERS_KEY = ["folders"] as const;

/**
 * @param deckId when given, each folder also reports whether it already holds that deck — the
 *               deck page's picker, in one request rather than one per folder. It is a separate
 *               cache entry from the plain list on purpose.
 */
export function useFolders(deckId?: string) {
  return useQuery({
    queryKey: [...FOLDERS_KEY, deckId ?? "all"],
    queryFn: async () => {
      const { data } = await api.get<FolderResponse[]>("/me/folders", {
        params: deckId ? { deckId } : undefined,
      });
      return data;
    },
  });
}

export function useFolder(folderId: string | null) {
  return useQuery({
    queryKey: ["folder", folderId],
    enabled: Boolean(folderId),
    queryFn: async () => {
      const { data } = await api.get<FolderDetailResponse>(`/me/folders/${folderId}`);
      return data;
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<FolderResponse>("/me/folders", { name });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const { data } = await api.patch<FolderResponse>(`/me/folders/${folderId}`, { name });
      return data;
    },
    onSuccess: (_data, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["folder", folderId] });
    },
  });
}

/** Deletes the folder only — the decks inside it are untouched. */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`/me/folders/${folderId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useFileDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, deckId, filed }: { folderId: string; deckId: string; filed: boolean }) => {
      const url = `/me/folders/${folderId}/decks/${deckId}`;
      if (filed) {
        await api.put(url);
      } else {
        await api.delete(url);
      }
    },
    onSuccess: (_data, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["folder", folderId] });
    },
  });
}
