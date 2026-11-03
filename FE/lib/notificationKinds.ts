// How each notification kind reads on the settings screen. The server sends a kind and a state,
// never a sentence — wording is the client's job, and this is the one place it lives.
//
// These are message KEYS rather than sentences because this is a module-level const, evaluated at
// import time, where there is no translator in scope. `NotificationSettingsSection` runs them
// through `t`.

import type { IconName } from "@/components/ui/icons";
import type { MessageKey } from "@/lib/i18n/messages/en";

export interface KindCopy {
  /** Null only for a kind we have no copy for — `fallbackLabel` carries the text instead. */
  labelKey: MessageKey | null;
  /** Null means no second line under the label. */
  descriptionKey: MessageKey | null;
  icon: IconName;
  /** Set only for an unknown kind: readable text built from the identifier, not a catalogue entry. */
  fallbackLabel?: string;
}

const COPY: Record<string, KindCopy> = {
  new_follower: {
    labelKey: "notifKind.newFollower",
    descriptionKey: "notifKind.newFollowerDesc",
    icon: "user",
  },
  author_published: {
    labelKey: "notifKind.authorPublished",
    descriptionKey: "notifKind.authorPublishedDesc",
    icon: "layers",
  },
  deck_shared: {
    labelKey: "notifKind.deckShared",
    descriptionKey: "notifKind.deckSharedDesc",
    icon: "cards",
  },
  deck_reviewed: {
    labelKey: "notifKind.deckReviewed",
    descriptionKey: "notifKind.deckReviewedDesc",
    icon: "star",
  },
};

/**
 * Wording for a kind, or a readable fallback.
 *
 * <p>The fallback matters: a backend newer than this client can offer a kind we have no copy for,
 * and a settings row reading "Deck admired" with a working toggle is still better than a missing
 * toggle the person cannot find.
 *
 * <p>⚠ That fallback is <b>not translatable</b> — it is built from the identifier the server sent,
 * so it stays in English in every locale. Adding the kind to the catalogue is what fixes it, and
 * the English row is the signal that one is missing.
 */
export function kindCopy(kind: string): KindCopy {
  return (
    COPY[kind] ?? {
      labelKey: null,
      descriptionKey: null,
      icon: "bell",
      fallbackLabel: kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
    }
  );
}
