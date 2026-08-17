import api from "@/lib/axios";
import { compressImage } from "@/lib/imageCompress";
import { existingMedia, mapWithConcurrency, sha256Hex } from "@/lib/mediaUpload";
import type { EditorState, EditorRow } from "@/lib/deckEditor";

// Images extracted from an imported .apkg arrive as `data:` URLs (the parse
// endpoint is stateless, so it can't store them). Before saving, each distinct
// image is compressed, content-hashed, and only uploaded if storage doesn't
// already have it — so re-importing a deck (or the 500th person importing a
// popular one) uploads ~0 new bytes. The DB never holds a megabyte of base64.
// Images the user added in-app are already real URLs and are left untouched.

function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

function dataUrlToFile(dataUrl: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?)(;|$)/.exec(meta)?.[1] || "image/png";
  const ext = mime.split("/")[1] || "png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], `card.${ext}`, { type: mime });
}

// Upload one prepared image File; the backend dedups by content hash and returns
// the (possibly pre-existing) public URL.
async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url: string }>("/me/card-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

// How many images to compress/hash/upload at once. A big image deck (a Core-2000
// export has ~200) processed one-at-a-time took the better part of a minute; a
// bounded pool cuts that to seconds without hammering Storage.
const CONCURRENCY = 6;

// Return a copy of the draft with every `data:` face image replaced by an uploaded
// (or already-stored) public URL. Each distinct image is compressed + hashed once;
// only hashes storage doesn't already have are uploaded. Throws if an upload fails
// (caller surfaces it). Rows with no data-URL images are returned as-is.
export async function uploadDraftImages(state: EditorState): Promise<EditorState> {
  const dataUrls = new Set<string>();
  for (const r of state.rows) {
    if (isDataUrl(r.frontImageUrl)) dataUrls.add(r.frontImageUrl);
    if (isDataUrl(r.backImageUrl)) dataUrls.add(r.backImageUrl);
  }
  if (dataUrls.size === 0) return state;

  // Compress + hash each distinct image (in parallel). Two data URLs can compress
  // to identical bytes → the same hash → uploaded once.
  const prepared = new Map<string, { file: File; hash: string }>();
  await mapWithConcurrency([...dataUrls], CONCURRENCY, async (dataUrl) => {
    const file = await compressImage(dataUrlToFile(dataUrl));
    const hash = await sha256Hex(await file.arrayBuffer());
    prepared.set(dataUrl, { file, hash });
  });

  // Which hashes does storage already have? Upload only the genuinely new ones.
  const distinctHashes = [...new Set([...prepared.values()].map((p) => p.hash))];
  const urlByHash = await existingMedia(distinctHashes);
  const toUpload = new Map<string, File>();
  for (const { file, hash } of prepared.values()) {
    if (!urlByHash.has(hash)) toUpload.set(hash, file); // dedups identical missing blobs
  }
  await mapWithConcurrency([...toUpload.entries()], CONCURRENCY, async ([hash, file]) => {
    urlByHash.set(hash, await uploadFile(file));
  });

  const map = new Map<string, string>(); // data URL → final public URL
  for (const [dataUrl, p] of prepared) map.set(dataUrl, urlByHash.get(p.hash) ?? dataUrl);

  const rows: EditorRow[] = state.rows.map((r) => {
    const front = isDataUrl(r.frontImageUrl) ? map.get(r.frontImageUrl) ?? r.frontImageUrl : r.frontImageUrl;
    const back = isDataUrl(r.backImageUrl) ? map.get(r.backImageUrl) ?? r.backImageUrl : r.backImageUrl;
    return front === r.frontImageUrl && back === r.backImageUrl ? r : { ...r, frontImageUrl: front, backImageUrl: back };
  });
  return { ...state, rows };
}

// True when the draft carries any image that still needs uploading (drives the
// "uploading images…" state on save).
export function draftHasPendingImages(state: EditorState): boolean {
  return state.rows.some((r) => isDataUrl(r.frontImageUrl) || isDataUrl(r.backImageUrl));
}
