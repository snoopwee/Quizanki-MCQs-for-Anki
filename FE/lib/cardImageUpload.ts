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

async function uploadDataUrl(dataUrl: string, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(dataUrl);
  if (hit) return hit;
  const form = new FormData();
  form.append("file", dataUrlToFile(dataUrl));
  const { data } = await api.post<{ url: string }>("/me/card-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  cache.set(dataUrl, data.url);
  return data.url;
}

// Return a copy of the draft with every `data:` face image replaced by an uploaded
// URL. Uploads happen once per distinct data URL. Rows with no data-URL images are
// returned as-is. Throws if any upload fails (caller surfaces it and keeps the draft).
export async function uploadDraftImages(state: EditorState): Promise<EditorState> {
  const hasData = state.rows.some(
    (r) => isDataUrl(r.frontImageUrl) || isDataUrl(r.backImageUrl),
  );
  if (!hasData) return state;

  const cache = new Map<string, string>();
  const rows: EditorRow[] = [];
  for (const r of state.rows) {
    const front = isDataUrl(r.frontImageUrl) ? await uploadDataUrl(r.frontImageUrl, cache) : r.frontImageUrl;
    const back = isDataUrl(r.backImageUrl) ? await uploadDataUrl(r.backImageUrl, cache) : r.backImageUrl;
    rows.push(front === r.frontImageUrl && back === r.backImageUrl ? r : { ...r, frontImageUrl: front, backImageUrl: back });
  }
  return { ...state, rows };
}

// True when the draft carries any image that still needs uploading (drives the
// "uploading images…" state on save).
export function draftHasPendingImages(state: EditorState): boolean {
  return state.rows.some((r) => isDataUrl(r.frontImageUrl) || isDataUrl(r.backImageUrl));
}
