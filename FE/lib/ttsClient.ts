import api from "@/lib/axios";

// Calls the backend cloud-TTS fallback for a single text segment whose language
// the visitor's device can't speak. Returns a playable audio URL (a cached
// Supabase Storage URL or an inline data URL). Throws on 503 (feature off) / 429
// (rate limited) / network error — callers treat that as "no cloud" and skip the
// segment, so the device-voice experience never breaks.
//
// Repeated plays of the same segment are served from a small in-memory cache so a
// re-listen doesn't re-hit the network (the backend caches too, but this avoids
// the round trip entirely).
const urlCache = new Map<string, string>();

export async function fetchTtsUrl(text: string, lang: string): Promise<string> {
  const key = `${lang}\n${text}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const { data } = await api.post<{ url: string }>("/public/tts", { text, lang });
  if (urlCache.size > 500) urlCache.clear(); // crude bound for a long session
  urlCache.set(key, data.url);
  return data.url;
}
