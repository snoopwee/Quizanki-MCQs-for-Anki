// The contract between the Quizanki browser extension and the web app.
//
// The extension (on quizlet.com / knowt.com) extracts a set into plain
// {front,back} pairs, opens `/import?from=extension`, and a content script it
// runs on OUR origin hands the pairs to the page via window.postMessage. The
// import page maps them into the existing review-before-save editor (same path as
// a text paste). The extension only ever ships text pairs, so the app's draft /
// EditorState shape stays owned by the app — an internal change here can't break
// the extension.
//
// Why postMessage over the same origin (not the extension writing our IndexedDB):
// the extension's content script runs in our page's origin, so `event.origin ===
// location.origin`; we accept only same-origin, same-window messages carrying our
// marker. Worst case if spoofed is a pre-filled review the user still has to
// choose to save — no privileged action, no token exposure.

import type { ParsedPair } from "@/lib/parsePlainText";

// Cap a single hand-off to the backend's MAX_NOTES so a huge/hostile message
// can't blow up the review editor.
export const MAX_IMPORT_PAIRS = 5000;

// Marker on messages the app trusts, and the app→extension "I'm listening" ping.
export const EXTENSION_MSG_SOURCE = "quizanki-extension";
export const APP_MSG_SOURCE = "quizanki-app";

export interface ExtensionImportMessage {
  source: typeof EXTENSION_MSG_SOURCE;
  type: "import-pairs";
  /** Optional set title from the source page; the page falls back to a default. */
  name?: string;
  pairs: { front: string; back: string }[];
}

/** Runtime guard for a message off the wire — never trust its shape. */
export function isExtensionImportMessage(data: unknown): data is ExtensionImportMessage {
  if (!data || typeof data !== "object") return false;
  const m = data as Record<string, unknown>;
  return (
    m.source === EXTENSION_MSG_SOURCE &&
    m.type === "import-pairs" &&
    Array.isArray(m.pairs) &&
    m.pairs.every(
      (p) =>
        p && typeof p === "object" &&
        typeof (p as Record<string, unknown>).front === "string" &&
        typeof (p as Record<string, unknown>).back === "string",
    )
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// Decode the handful of HTML entities that survive a source's markup, plus numeric
// (&#39; / &#x2019;) forms. Kept regex-based (no DOM) so it runs the same in the
// browser and in node tests.
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const cp =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/**
 * Tidy one field from a source page for display in the review editor: turn <br>
 * into a space, drop remaining HTML tags, decode entities, collapse whitespace,
 * trim. The backend's `cleanField` does the authoritative clean on save; this is
 * so the review step reads cleanly first.
 */
export function normalizeField(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize extracted pairs into the paste-import shape. Cleans both faces, drops
 * rows where BOTH sides are empty (a one-sided row is kept — the editor allows a
 * blank face), and caps the count.
 */
export function normalizePairs(pairs: { front: string; back: string }[]): ParsedPair[] {
  const out: ParsedPair[] = [];
  for (const p of pairs) {
    const front = normalizeField(p.front);
    const back = normalizeField(p.back);
    if (front === "" && back === "") continue;
    out.push({ front, back });
    if (out.length >= MAX_IMPORT_PAIRS) break;
  }
  return out;
}
