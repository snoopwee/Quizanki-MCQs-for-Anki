import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import api from "@/lib/axios";

/**
 * Push the signed-in user's display name + avatar onto the decks they authored.
 *
 * Deck author name/avatar are denormalised snapshots (there's no user table), so a
 * profile change must be propagated or old decks — and Discover / shared / author /
 * Home pages that render them — keep showing the stale values. We send the values
 * explicitly so it applies even before the JWT refreshes; refreshing the session
 * first also lets the server-side fallback see a cleared field.
 *
 * Best-effort: the Supabase metadata write already succeeded before this runs, and
 * propagation self-heals on the next change, so callers ignore failures here.
 */
export async function propagateAuthorProfile(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  profile: { name: string; avatarUrl: string | null },
): Promise<void> {
  try {
    await supabase.auth.refreshSession();
    await api.put("/me/author-profile", {
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    // Drop every cache that renders the author name/avatar so they refresh without
    // a reload. `["decks"]` also covers the Home saved/recent lists (prefix match).
    for (const key of [["deck-contents"], ["discover"], ["shared-deck"], ["author"], ["decks"]]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  } catch {
    // Propagation is best-effort; the profile itself is already saved.
  }
}
