import type { ApkgParseResponse, DeckContentsResponse } from "@/types/api";

// Adapts a saved deck's contents into the same shape as the .apkg parse response,
// so the flashcard viewer and quiz setup can be reused unchanged. The persisted
// note UUID is carried through as `ApkgParsedNote.id` so the quiz records answers
// against the real note. Note-type ids fall back to their index since the saved
// note-type id is a UUID and ApkgNoteType.id is numeric (used only as a key).
export function deckContentsToParsed(contents: DeckContentsResponse): ApkgParseResponse {
  return {
    filename: contents.name,
    collectionFile: "",
    schema: "",
    totalNotes: contents.cardCount ?? 0,
    skippedNotes: 0,
    noteTypes: contents.noteTypes.map((nt, ti) => ({
      id: nt.ankiModelId ?? ti,
      name: nt.name,
      cloze: nt.cloze,
      fieldNames: nt.fieldNames,
      frontFields: nt.frontFields,
      backFields: nt.backFields,
      noteCount: nt.noteCount,
      notes: nt.notes.map((n) => ({
        id: n.id,
        ankiNoteId: n.ankiNoteId,
        fields: n.fields,
        tags: n.tags,
      })),
    })),
  };
}
