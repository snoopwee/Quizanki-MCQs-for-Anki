// The contract between the Quizanki browser extension and the web app.
//
// The extension (on quizlet.com / knowt.com) extracts a set into {front,back}
// pairs — each face optionally carrying an inlined picture — opens
// `/import?from=extension`, and a content script it runs on OUR origin hands the
// pairs to the page via window.postMessage. The import page maps them into the
// existing review-before-save editor (same path as a text paste). The extension
// ships only text plus base64 pictures, never app types, so the draft /
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

// Longest accepted picture, as data-URL characters (~6 MB of bytes). The extension
// already caps what it sends; this is the app refusing to be the one that blows up.
export const MAX_IMAGE_DATA_URL_CHARS = 8 * 1024 * 1024;

// A picture arrives inlined as a base64 data URL, which is exactly what the save
// path wants (lib/cardImageUpload.ts compresses, hashes, dedupes and uploads any
// `data:` face image). Accept only raster types we can re-encode or pass through —
// notably GIF, so animated cards survive. SVG is deliberately excluded: it is a
// document format that can carry script, and nothing on Quizlet/Knowt needs it.
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/;

/** True for a picture we're willing to take off the wire. */
export function isSafeImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_IMAGE_DATA_URL_CHARS &&
    IMAGE_DATA_URL.test(value)
  );
}

export interface ExtensionImportPair {
  front: string;
  back: string;
  /** Inlined picture for that face, as a base64 `data:` URL. Absent = no picture. */
  frontImage?: string;
  backImage?: string;
}

export interface ExtensionImportMessage {
  source: typeof EXTENSION_MSG_SOURCE;
  type: "import-pairs";
  /** Optional set title from the source page; the page falls back to a default. */
  name?: string;
  pairs: ExtensionImportPair[];
}

// Images are optional and validated separately in normalizePairs, so a single
// malformed picture downgrades one face instead of rejecting the whole hand-off.
const isOptionalString = (v: unknown) => v === undefined || typeof v === "string";

/** Runtime guard for a message off the wire — never trust its shape. */
export function isExtensionImportMessage(data: unknown): data is ExtensionImportMessage {
  if (!data || typeof data !== "object") return false;
  const m = data as Record<string, unknown>;
  return (
    m.source === EXTENSION_MSG_SOURCE &&
    m.type === "import-pairs" &&
    Array.isArray(m.pairs) &&
    m.pairs.every((p) => {
      if (!p || typeof p !== "object") return false;
      const r = p as Record<string, unknown>;
      return (
        typeof r.front === "string" &&
        typeof r.back === "string" &&
        isOptionalString(r.frontImage) &&
        isOptionalString(r.backImage)
      );
    })
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

/** A paste-import pair that may also carry a picture per face ("" = none). */
export interface ImportedPair extends ParsedPair {
  frontImage: string;
  backImage: string;
}

/**
 * Normalize extracted pairs into the paste-import shape. Cleans both faces, keeps
 * each face's picture only if it's a well-formed image data URL, drops rows that
 * carry NOTHING at all (a one-sided row is kept — the editor allows a blank face,
 * and a picture-only card is a legitimate card), and caps the count.
 */
export function normalizePairs(pairs: ExtensionImportPair[]): ImportedPair[] {
  const out: ImportedPair[] = [];
  for (const p of pairs) {
    const front = normalizeField(p.front);
    const back = normalizeField(p.back);
    const frontImage = isSafeImageDataUrl(p.frontImage) ? p.frontImage : "";
    const backImage = isSafeImageDataUrl(p.backImage) ? p.backImage : "";
    if (front === "" && back === "" && frontImage === "" && backImage === "") continue;
    out.push({ front, back, frontImage, backImage });
    if (out.length >= MAX_IMPORT_PAIRS) break;
  }
  return out;
}
