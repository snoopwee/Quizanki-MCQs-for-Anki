import api from "@/lib/axios";
import type { EditorState, EditorRow } from "@/lib/deckEditor";

// Images extracted from an imported .apkg arrive as `data:` URLs (the parse
// endpoint is stateless, so it can't store them). Before saving, upload each one
// to our storage and swap in the returned public URL — the DB never holds a
// megabyte of base64. Images the user added in-app are already real URLs and are
// left untouched.

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

async function uploadDataUrl(dataUrl: string): Promise<string> {
  const form = new FormData();
  form.append("file", dataUrlToFile(dataUrl));
  const { data } = await api.post<{ url: string }>("/me/card-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

// How many card images to upload at once. A big image deck (a Core-2000 export has
// ~200 images) uploaded one-at-a-time took the better part of a minute; a bounded
// pool cuts that to a few seconds without hammering Storage.
const UPLOAD_CONCURRENCY = 6;

// Upload every distinct data URL with bounded parallelism → data URL → public URL.
// Throws on the first failure (Promise.all rejects), which the caller surfaces.
async function uploadAll(dataUrls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let next = 0;
  async function worker() {
    while (next < dataUrls.length) {
      const url = dataUrls[next++];
      map.set(url, await uploadDataUrl(url));
    }
  }
  const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, dataUrls.length) }, worker);
  await Promise.all(workers);
  return map;
}

// Return a copy of the draft with every `data:` face image replaced by an uploaded
// URL. Each distinct data URL is uploaded once, in parallel. Rows with no data-URL
// images are returned as-is. Throws if any upload fails (caller surfaces it).
export async function uploadDraftImages(state: EditorState): Promise<EditorState> {
  const dataUrls = new Set<string>();
  for (const r of state.rows) {
    if (isDataUrl(r.frontImageUrl)) dataUrls.add(r.frontImageUrl);
    if (isDataUrl(r.backImageUrl)) dataUrls.add(r.backImageUrl);
  }
  if (dataUrls.size === 0) return state;

  const map = await uploadAll([...dataUrls]);
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
