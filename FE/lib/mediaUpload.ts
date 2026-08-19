import api from "@/lib/axios";

// Content-addressed media helpers, shared by the image (and later audio) upload
// paths. The browser hashes each blob and asks the backend which hashes it already
// has, so identical media is never re-uploaded — the same trick the backend uses
// to store each blob once. The hash must match the backend's
// MediaObjectService.sha256Hex exactly (both: lowercase hex of a raw SHA-256).

/** Lowercase-hex SHA-256 of the bytes — the content-address key. */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Pass a fresh ArrayBuffer slice so a Uint8Array view with an offset still hashes
  // only its own bytes.
  const digest = await crypto.subtle.digest("SHA-256", view.slice().buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ask the backend which of these content hashes it already has, as hash → public
 * URL. Missing hashes are simply absent from the map, so the caller uploads them.
 * An empty input skips the round-trip.
 */
export async function existingMedia(hashes: string[]): Promise<Map<string, string>> {
  if (hashes.length === 0) return new Map();
  const { data } = await api.post<{ urls: Record<string, string> }>("/me/media/exists", { hashes });
  return new Map(Object.entries(data.urls ?? {}));
}

/**
 * Run an async task over items with a bounded number in flight at once. Shared by
 * the media paths so a big deck doesn't fire hundreds of requests simultaneously.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
