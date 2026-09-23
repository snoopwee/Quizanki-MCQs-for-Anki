/**
 * Where somebody's public profile lives.
 *
 * Two URLs point at one page: `/user/{username}` is the real one — readable, shareable, what people
 * paste into a chat — and `/authors/{userId}` is a permanent alias that redirects to it. The alias
 * exists because handles are changeable and user ids are not, so anything we STORE (a notification
 * row, a link somebody saved a year ago) has to be written against the id.
 *
 * Prefer the handle whenever the caller has one; fall back to the id, which always works.
 */
export function profileUrl(userId: string, username?: string | null): string {
  return username ? `/user/${encodeURIComponent(username)}` : `/authors/${userId}`;
}
