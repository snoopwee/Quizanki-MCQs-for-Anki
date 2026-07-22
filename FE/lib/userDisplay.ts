import type { User } from "@supabase/supabase-js";

// Shared helpers for presenting the signed-in user (sidebar account menu +
// profile page). Identity lives in Supabase auth — there's no backend user table
// — so the human name comes from user_metadata, which the SDK types loosely.

/** Read a string field off Supabase user_metadata (returns "" when absent). */
export function metaString(user: User | null, key: string): string {
  const v = user?.user_metadata?.[key];
  return typeof v === "string" ? v : "";
}

/** Preferred human name: display_name, then full_name, else "". */
export function displayNameOf(user: User | null): string {
  return metaString(user, "display_name") || metaString(user, "full_name");
}

// We store an uploaded avatar under our OWN key, separate from `avatar_url` —
// because Google OAuth populates `avatar_url`/`picture` itself, and we must not
// clobber that (it's the default) or mistake it for a user upload.
export const CUSTOM_AVATAR_KEY = "custom_avatar_url";

/**
 * The user's avatar image URL, or "" when they have none. Order of preference:
 * their uploaded photo → the OAuth photo (Google sets `avatar_url`/`picture`, so
 * social sign-ins get one for free) → "" (the caller shows initials).
 */
export function avatarUrlOf(user: User | null): string {
  return (
    metaString(user, CUSTOM_AVATAR_KEY) ||
    metaString(user, "avatar_url") ||
    metaString(user, "picture")
  );
}

/** True only when the user has uploaded their own photo (vs. an OAuth default). */
export function hasCustomAvatar(user: User | null): boolean {
  return Boolean(metaString(user, CUSTOM_AVATAR_KEY));
}

/** 1–2 letter avatar initials from a name (preferred) or the email as fallback. */
export function initialsFrom(name: string, email: string): string {
  const src = name.trim() || email.trim();
  if (!src) return "?";
  const words = src.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
