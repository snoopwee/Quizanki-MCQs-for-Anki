import type { ApkgParseResponse, ImportDeckRequest } from "@/types/api";
import { buildFlashcards } from "@/lib/flashcards";
import { majorityFaceLang } from "@/lib/faceLanguage";

// Converts a parsed .apkg into the nested deck-import payload. Note types with no
// notes or no fields are dropped (the BE rejects empty ones). The deck name
// defaults to the filename without its .apkg extension. The deck's primary TTS
// language per face is seeded here from the majority language across all cards.
export function parsedToImportRequest(parsed: ApkgParseResponse): ImportDeckRequest {
  // Detect the deck-level language per face from the actual card faces (same
  // front/back build the viewer uses), so bare-kanji Japanese decks default to
  // Japanese rather than Chinese. "" majority → null (auto-detect).
  const cards = buildFlashcards(parsed.noteTypes);
  const frontLang = majorityFaceLang(cards.map((c) => c.front)) || null;
  const backLang = majorityFaceLang(cards.map((c) => c.back)) || null;

  const noteTypes = parsed.noteTypes
    .filter((nt) => nt.notes.length > 0 && nt.fieldNames.length > 0)
    .map((nt) => ({
      ankiModelId: nt.id,
      name: nt.name,
      cloze: nt.cloze,
      fieldNames: nt.fieldNames,
      frontFields: nt.frontFields,
      backFields: nt.backFields,
      notes: nt.notes.map((n) => ({
        ankiNoteId: n.ankiNoteId,
        fields: n.fields,
        tags: n.tags,
      })),
    }));

  return {
    name: parsed.filename.replace(/\.apkg$/i, "") || parsed.filename,
    subdeckPath: null,
    sourceFilename: parsed.filename,
    frontLang,
    backLang,
    noteTypes,
  };
}
