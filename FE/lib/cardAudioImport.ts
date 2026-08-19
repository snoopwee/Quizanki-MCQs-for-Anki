import api from "@/lib/axios";
import type { ApkgParseResponse } from "@/types/api";

// Imported .apkg audio can't ride through the review draft the way images do — a
// deck's clips are far too large to carry as base64. Instead the parse records each
// note's [sound:] filename (a tiny ref), and after the deck is saved we re-send the
// original .apkg to the backend, which streams just those clips to storage.

// One note's audio references, keyed by its Anki id so the backend can match it to
// the saved note even after review edits (reorder / rename / delete).
export interface AudioRef {
  ankiNoteId: string;
  front: string | null;
  back: string | null;
}

// Collect the per-note audio refs from a fresh parse. Only notes with an Anki id
// and at least one [sound:] face are included — everything else is skipped, so an
// empty result means "no audio to import".
export function buildAudioRefs(parsed: ApkgParseResponse): AudioRef[] {
  const refs: AudioRef[] = [];
  for (const nt of parsed.noteTypes) {
    for (const note of nt.notes) {
      if (!note.ankiNoteId) continue;
      const front = note.frontAudioRef ?? null;
      const back = note.backAudioRef ?? null;
      if (!front && !back) continue;
      refs.push({ ankiNoteId: note.ankiNoteId, front, back });
    }
  }
  return refs;
}

export interface AudioImportResult {
  notesUpdated: number;
  clipsImported: number;
}

// Re-send the .apkg + the collected refs so the backend imports the deck's audio.
// Multipart: the file plus a JSON "refs" part the backend binds to ImportAudioRequest.
export async function importDeckAudio(
  deckId: string,
  file: File,
  refs: AudioRef[],
): Promise<AudioImportResult> {
  const form = new FormData();
  form.append("apkg", file);
  form.append(
    "refs",
    new Blob([JSON.stringify({ notes: refs })], { type: "application/json" }),
  );
  const { data } = await api.post<AudioImportResult>(
    `/decks/${deckId}/import-audio`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
