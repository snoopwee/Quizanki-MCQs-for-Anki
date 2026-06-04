// Per-note "star" (focus flag) for the logged-out trial flow. Mirrors
// guestStarStore's sibling, the guest mastery store: guests have no card_stats
// row on the server, so their stars live here — persisted to localStorage so a
// star set while studying survives navigation between the flashcard / setup /
// quiz screens. Like guest mastery, these are throwaway on signup (the saved
// deck starts unstarred); see ROADMAP Phase 4 / the guest-mastery decision.
//
// Keyed by the same note id the quiz uses — ankiNoteId for a freshly-parsed
// guest deck (authed users don't read this store, they hit the API).

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestStarState {
  byNote: Record<string, boolean>;
  isStarred: (noteId: string) => boolean;
  setStarred: (noteId: string, starred: boolean) => void;
  toggle: (noteId: string) => boolean;
  reset: () => void;
}

export const useGuestStars = create<GuestStarState>()(
  persist(
    (set, get) => ({
      byNote: {},
      isStarred: (noteId) => get().byNote[noteId] === true,
      setStarred: (noteId, starred) =>
        set({ byNote: { ...get().byNote, [noteId]: starred } }),
      toggle: (noteId) => {
        const next = !get().byNote[noteId];
        set({ byNote: { ...get().byNote, [noteId]: next } });
        return next;
      },
      reset: () => set({ byNote: {} }),
    }),
    { name: "quizanki:guest-stars" },
  ),
);
