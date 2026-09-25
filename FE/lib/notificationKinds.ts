// How each notification kind reads on the settings screen. The server sends a kind and a state,
// never a sentence — wording is the client's job, and this is the one place it lives.

import type { IconName } from "@/components/ui/icons";

interface KindCopy {
  label: string;
  description: string;
  icon: IconName;
}

const COPY: Record<string, KindCopy> = {
  new_follower: {
    label: "New followers",
    description: "When somebody starts following you.",
    icon: "user",
  },
  author_published: {
    label: "New decks from authors you follow",
    description: "When someone you follow publishes a deck.",
    icon: "layers",
  },
  deck_shared: {
    label: "Decks shared with you",
    description: "When somebody sends you a deck directly.",
    icon: "cards",
  },
  deck_reviewed: {
    label: "Feedback on your decks",
    description: "When someone leaves a note with their rating. Only you can read those.",
    icon: "star",
  },
};

/**
 * Wording for a kind, or a readable fallback. The fallback matters: a backend newer than this
 * client can offer a kind we have no copy for, and a settings row reading "deck_admired" is still
 * better than a missing toggle the person can't find.
 */
export function kindCopy(kind: string): KindCopy {
  return (
    COPY[kind] ?? {
      label: kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      description: "",
      icon: "bell",
    }
  );
}
