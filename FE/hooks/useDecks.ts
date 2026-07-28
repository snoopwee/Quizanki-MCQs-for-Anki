import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
  AuthorPageResponse,
  DeckContentsResponse,
  DeckResponse,
  ImportDeckRequest,
  PublicDeckPage,
  UpdateDeckContentsRequest,
} from "@/types/api";

const DECKS_KEY = ["decks"] as const;

export function useDecks() {
  return useQuery({
    queryKey: DECKS_KEY,
    queryFn: async () => {
      const { data } = await api.get<DeckResponse[]>("/decks");
      return data;
    },
  });
}

const SAVED_KEY = ["decks", "saved"] as const;
const RECENT_KEY = ["decks", "recent"] as const;

// The Home "Saved" tab: decks the user bookmarked but doesn't own.
export function useSavedDecks() {
  return useQuery({
    queryKey: SAVED_KEY,
    queryFn: async () => {
      const { data } = await api.get<DeckResponse[]>("/decks/saved");
      return data;
    },
  });
}

// The Home "Recent" tab: decks opened in the last 30 days.
export function useRecentDecks() {
  return useQuery({
    queryKey: RECENT_KEY,
    queryFn: async () => {
      const { data } = await api.get<DeckResponse[]>("/decks/recent");
      return data;
    },
  });
}

// Bookmark a deck to Home (or remove it) — a reference, not a copy. Refreshes the
// deck's own contents (the Save toggle reads `saved` from there) plus the Home lists.
export function useSaveDeck(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (saved: boolean) => {
      await api.put(`/decks/${deckId}/save`, { saved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
      queryClient.invalidateQueries({ queryKey: RECENT_KEY });
    },
  });
}

// Mark a deck opened so it shows in Recent. Fire-and-forget from the deck page on
// mount; a failure (e.g. a deck you can't study) is harmless and ignored.
export function useOpenDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.post(`/decks/${deckId}/open`);
    },
    onSuccess: () => {
      // Only mark Recent stale — don't refetch now. This fires while the user is
      // on the deck page (not Home), so an immediate /decks/recent round-trip is
      // pure waste; Home refetches it on its next mount, which is soon enough.
      queryClient.invalidateQueries({ queryKey: RECENT_KEY, refetchType: "none" });
    },
  });
}

export function useDeckContents(deckId: string) {
  return useQuery({
    queryKey: ["deck-contents", deckId],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<DeckContentsResponse>(`/decks/${deckId}/contents`);
      return data;
    },
  });
}

export function useImportDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ImportDeckRequest) => {
      const { data } = await api.post<DeckResponse>("/decks", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

// Rename a deck. Invalidates both the deck list (dashboard) and this deck's
// contents (its detail page header) so the new name shows everywhere at once.
export function useRenameDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deckId, name }: { deckId: string; name: string }) => {
      const { data } = await api.patch<DeckResponse>(`/decks/${deckId}`, { name });
      return data;
    },
    onSuccess: (_data, { deckId }) => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
    },
  });
}

// Set the deck's primary TTS language per face (Flashcards Options modal). The
// server returns the refreshed contents, which we drop straight into the cache
// so the viewer picks up the new default immediately.
export function useSetDeckLanguages(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ frontLang, backLang }: { frontLang: string; backLang: string }) => {
      const { data } = await api.put<DeckContentsResponse>(
        `/decks/${deckId}/languages`,
        { frontLang, backLang },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["deck-contents", deckId], data);
    },
  });
}

// Save the whole flashcard editor working set (rename + add/delete/reorder/swap/
// edit) in one request. Invalidates everything that shows deck contents/order/name.
export function useReplaceDeckContents(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateDeckContentsRequest) => {
      const { data } = await api.put<DeckContentsResponse>(
        `/decks/${deckId}/contents`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
      queryClient.invalidateQueries({ queryKey: ["notes", deckId] });
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

// Download a deck as an Anki .apkg. The backend assembles the package and streams
// it back as a blob; we turn that into a browser download. Pass the desired
// filename (e.g. "JLPT_N4.apkg").
export function useExportApkg(deckId: string) {
  return useMutation({
    mutationFn: async (filename: string) => {
      const { data } = await api.get<Blob>(`/decks/${deckId}/export.apkg`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

// Turn this deck's public share link on or off. Refreshes the deck list (so a
// "Shared" badge stays accurate) and this deck's contents, which is where the
// share modal reads the current state from.
export function useShareDeck(deckId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isPublic: boolean) => {
      const { data } = await api.patch<DeckResponse>(`/decks/${deckId}/share`, { isPublic });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
      queryClient.invalidateQueries({ queryKey: ["deck-contents", deckId] });
    },
  });
}

// Read a shared deck without authentication — this backs the public
// /shared/{deckId} page. 404s when the deck isn't (or is no longer) shared, so
// don't retry: a missing share is a permanent answer, not a blip.
export function useSharedDeck(deckId: string) {
  return useQuery({
    queryKey: ["shared-deck", deckId],
    enabled: Boolean(deckId),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<DeckContentsResponse>(`/public/shared/${deckId}`);
      return data;
    },
  });
}

// Copy a shared deck into the signed-in user's account. The copy is independent:
// its own notes, its own progress, and private until they share it themselves.
export function useCloneDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceDeckId: string) => {
      const { data } = await api.post<DeckResponse>(`/decks/${sourceDeckId}/clone`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

export interface DiscoverParams {
  q: string;
  minCards: number | null;
  maxCards: number | null;
  page: number; // zero-based
  pageSize: number;
}

// The public Discover directory. Unauthenticated — guests browse the same list
// as members; only copying a deck needs an account. Keyed by the full param set,
// so each (search × filter × page) combination is cached independently and paging
// back is instant. `placeholderData` keeps the current page on screen while the
// next loads, so changing page/filter doesn't flash an empty grid.
export function useDiscoverDecks(params: DiscoverParams) {
  return useQuery({
    queryKey: ["discover", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<PublicDeckPage>("/public/discover", {
        params: {
          q: params.q || undefined,
          minCards: params.minCards ?? undefined,
          maxCards: params.maxCards ?? undefined,
          limit: params.pageSize,
          offset: params.page * params.pageSize,
        },
      });
      return data;
    },
  });
}

// An author's public decks + identity. Public — guests can view an author page.
// A 404 (no such author / no public decks) is a permanent answer, so don't retry.
export function useAuthorPage(authorId: string) {
  return useQuery({
    queryKey: ["author", authorId],
    enabled: Boolean(authorId),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<AuthorPageResponse>(`/public/authors/${authorId}`);
      return data;
    },
  });
}

// How many people have taken a copy of this deck.
export function useDeckCopies(deckId: string) {
  return useQuery({
    queryKey: ["deck-copies", deckId],
    enabled: Boolean(deckId),
    queryFn: async () => {
      const { data } = await api.get<{ copies: number }>(`/decks/${deckId}/copies`);
      return data.copies;
    },
  });
}

export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.delete(`/decks/${deckId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}
