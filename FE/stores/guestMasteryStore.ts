// Per-note mastery for the logged-out trial flow. Guests have no card_stats
// row on the server, so their progress lives here — persisted to localStorage
// so it survives navigation and the signup redirect (after which a future
// handoff endpoint will seed it into the user's account; see ROADMAP Phase 4).
//
// Keyed by whatever id the quiz uses to identify a note. For a guest's freshly-
// parsed .apkg that's the ankiNoteId; for an authed user with a saved deck it'd
// be the persisted note UUID — but authed users don't read this store, so it
// only ever holds ankiNoteId-keyed entries in practice.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyAnswer } from "@/lib/mastery";

export interface GuestStats {
  mastery: number;
  timesSeen: number;
}

const EMPTY: GuestStats = { mastery: 0, timesSeen: 0 };

interface GuestMasteryState {
  byNote: Record<string, GuestStats>;
  recordAnswer: (noteId: string, correct: boolean) => GuestStats;
  getStats: (noteId: string) => GuestStats;
  reset: () => void;
}

export const useGuestMastery = create<GuestMasteryState>()(
  persist(
    (set, get) => ({
      byNote: {},
      recordAnswer: (noteId, correct) => {
        const current = get().byNote[noteId] ?? EMPTY;
        const next: GuestStats = {
          mastery: applyAnswer(current.mastery, correct),
          timesSeen: current.timesSeen + 1,
        };
        set({ byNote: { ...get().byNote, [noteId]: next } });
        return next;
      },
      getStats: (noteId) => get().byNote[noteId] ?? EMPTY,
      reset: () => set({ byNote: {} }),
    }),
    { name: "quizanki:guest-mastery" },
  ),
);
