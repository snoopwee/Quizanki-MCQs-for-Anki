import { describe, expect, it } from "vitest";
import { kindCopy } from "@/lib/notificationKinds";
import { en } from "@/lib/i18n/messages/en";
import { vi as viMessages } from "@/lib/i18n/messages/vi";

// The kinds the backend sends today. If one of these loses its copy, the settings screen shows a
// row labelled "New follower" instead of "New followers" — readable, but a regression.
const KNOWN = ["new_follower", "author_published", "deck_shared", "deck_reviewed"];

describe("kindCopy", () => {
  it("has real copy for every kind the backend sends", () => {
    for (const kind of KNOWN) {
      const copy = kindCopy(kind);
      expect(copy.labelKey, kind).not.toBeNull();
      expect(copy.descriptionKey, kind).not.toBeNull();
      expect(copy.fallbackLabel, kind).toBeUndefined();
      expect(copy.icon, kind).not.toBe("bell");
    }
  });

  it("points only at keys that exist in BOTH catalogues", () => {
    // The whole point of returning keys rather than sentences: a typo here would render the key
    // itself on screen. `vi` is typed from `en`, so checking both is belt and braces against a
    // key that was removed from the catalogue but left referenced here.
    for (const kind of KNOWN) {
      const { labelKey, descriptionKey } = kindCopy(kind);
      expect(en[labelKey!], labelKey!).toBeDefined();
      expect(en[descriptionKey!], descriptionKey!).toBeDefined();
      expect(viMessages[labelKey!], labelKey!).toBeDefined();
      expect(viMessages[descriptionKey!], descriptionKey!).toBeDefined();
    }
  });

  it("humanises an unknown kind rather than dropping the row", () => {
    // A backend newer than this client. The toggle still has to be findable.
    const copy = kindCopy("deck_admired");
    expect(copy.labelKey).toBeNull();
    expect(copy.descriptionKey).toBeNull();
    expect(copy.fallbackLabel).toBe("Deck admired");
    expect(copy.icon).toBe("bell");
  });

  it("survives a kind with no underscores and an empty one", () => {
    expect(kindCopy("mentioned").fallbackLabel).toBe("Mentioned");
    expect(kindCopy("").fallbackLabel).toBe("");
  });
});
