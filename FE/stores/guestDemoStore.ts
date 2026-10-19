// Which decks a guest has already spent their one free quiz run on.
//
// Persisted so the limit survives a reload and a navigation, exactly like the guest's mastery and
// stars. It is a conversion nudge rather than a lock — see `guestDemoKey` for why that is the
// right strength — so nothing here tries to be tamper-proof.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { guestDemoKey, hasUsedDemo, type GuestDemoSource } from "@/lib/guestDemo";

interface GuestDemoState {
  /** key → when it was used (epoch ms). The timestamp is for a future "your free run was N days
   *  ago" message; nothing reads it yet, and a plain `true` would have been harder to grow. */
  usedByDeck: Record<string, number>;
  hasUsed: (source: GuestDemoSource) => boolean;
  markUsed: (source: GuestDemoSource) => void;
  reset: () => void;
}

export const useGuestDemo = create<GuestDemoState>()(
  persist(
    (set, get) => ({
      usedByDeck: {},
      hasUsed: (source) => hasUsedDemo(get().usedByDeck, guestDemoKey(source)),
      markUsed: (source) => {
        const key = guestDemoKey(source);
        // First run wins: re-marking would move the timestamp and, later, reset that message.
        if (hasUsedDemo(get().usedByDeck, key)) return;
        set({ usedByDeck: { ...get().usedByDeck, [key]: Date.now() } });
      },
      reset: () => set({ usedByDeck: {} }),
    }),
    { name: "quizanki:guest-demo" },
  ),
);
