// Pure helpers for putting folders in the sidebar rail. Kept out of the component so the two
// decisions that are easy to get wrong — which folders a capped list shows, and when a nav entry
// counts as active — are testable without rendering the shell.

import type { FolderResponse } from "@/types/api";

/** Where one folder lives. The id stays in the URL — names change, ids don't. */
export function folderHref(folderId: string): string {
  return `/folders/${folderId}`;
}

/** How many folders the rail lists before it stops and points at the full page. */
export const RAIL_FOLDER_LIMIT = 6;

/**
 * What the rail shows, and how many it had to leave out.
 *
 * <p>Ordered by **most recently touched**, not alphabetically. A capped alphabetical list would
 * permanently hide everything after the sixth name — a user with twenty folders would only ever
 * see the A's. Recency shows what they are actually working on. Ties break on name so two folders
 * touched in the same second don't swap places between renders.
 */
export function railFolders(
  folders: FolderResponse[] | undefined,
  limit: number = RAIL_FOLDER_LIMIT,
): { shown: FolderResponse[]; overflow: number } {
  const all = folders ?? [];
  if (limit <= 0) return { shown: [], overflow: all.length };

  const sorted = [...all].sort((a, b) => {
    const byTime = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    return byTime !== 0 ? byTime : a.name.localeCompare(b.name);
  });

  return { shown: sorted.slice(0, limit), overflow: Math.max(0, all.length - limit) };
}

/**
 * Whether a nav entry should read as active.
 *
 * <p>Exact match by default — that is what every entry wanted before folders existed. A section
 * that owns sub-routes (`/folders` owning `/folders/{id}`) also matches anything beneath it, so
 * opening a folder doesn't un-highlight the rail. The trailing slash matters: without it
 * `/folders` would also claim a sibling route like `/folders-archive`.
 */
export function navMatches(pathname: string, href: string, ownsSubRoutes = false): boolean {
  if (pathname === href) return true;
  return ownsSubRoutes && pathname.startsWith(`${href}/`);
}
