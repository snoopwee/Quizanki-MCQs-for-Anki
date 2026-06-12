// Pure helpers for the quiz-setup tag filter. Kept out of the component so the
// set composition -- how a tag filter intersects the All / Starred / Still-learning
// source -- is unit-testable.
import type { ApkgNoteType, ApkgParsedNote } from "@/types/api";

/** Every distinct tag across the given note types, sorted for a stable UI. */
export function collectTags(types: ApkgNoteType[]): string[] {
  const set = new Set<string>();
  for (const nt of types) {
    for (const n of nt.notes) {
      for (const t of n.tags) {
        if (t) set.add(t);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Note keys whose tags intersect `selected` (OR semantics -- a note matches when
 * it carries ANY chosen tag). `keyOf` maps a note to the id the quiz pool tracks
 * it by, so the result composes with the starred / weak id sets. An empty
 * selection yields an empty set (caller treats that as "no tag constraint").
 */
export function idsWithAnyTag(
  types: ApkgNoteType[],
  selected: Set<string>,
  keyOf: (nt: ApkgNoteType, n: ApkgParsedNote, i: number) => string,
): Set<string> {
  const ids = new Set<string>();
  if (selected.size === 0) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      if (n.tags.some((t) => selected.has(t))) ids.add(keyOf(nt, n, i));
    });
  }
  return ids;
}

/**
 * Compose two optional id constraints. `null` means "no constraint" (all cards);
 * two non-null sets intersect, since a card must satisfy both the source slice
 * and the tag filter to be askable.
 */
export function intersectIds(
  a: Set<string> | null,
  b: Set<string> | null,
): Set<string> | null {
  if (!a) return b;
  if (!b) return a;
  const out = new Set<string>();
  for (const id of a) if (b.has(id)) out.add(id);
  return out;
}
