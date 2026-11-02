import type { MessageKey } from "@/lib/i18n/messages/en";
// Discover filters, kept as data so the page stays declarative and new filters
// slot in without touching the UI. Today there's just deck size; as decks grow
// richer (subject, language, tags) this is where those live.
//
// Size buckets are half-open by the usual histogram convention — the upper bound
// belongs to the NEXT bucket — so every deck lands in exactly one, no overlap.
// `min`/`max` are inclusive card counts sent straight to the API; null = no bound.

export interface SizeFilter {
  id: string;
  /** A message key — this is a module-level const, so it cannot translate itself. */
  labelKey: MessageKey;
  min: number | null;
  max: number | null;
}

export const SIZE_FILTERS: SizeFilter[] = [
  { id: "all", labelKey: "size.any", min: null, max: null },
  { id: "u20", labelKey: "size.under20", min: null, max: 19 },
  { id: "20-50", labelKey: "size.20to50", min: 20, max: 49 },
  { id: "50-100", labelKey: "size.50to100", min: 50, max: 99 },
  { id: "100+", labelKey: "size.100plus", min: 100, max: null },
];

export const DEFAULT_SIZE_FILTER = SIZE_FILTERS[0];

export function sizeFilterById(id: string): SizeFilter {
  return SIZE_FILTERS.find((f) => f.id === id) ?? DEFAULT_SIZE_FILTER;
}
