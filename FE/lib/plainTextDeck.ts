// Builds deck payloads from Quizlet-style plain-text pairs (see parsePlainText).
// Every pasted card becomes a Basic (Front/Back), non-cloze note — the same
// shape the in-editor "Import cards" modal produces. Used by the /import page's
// "Paste text" source.

import type { ApkgParseResponse, ImportDeckRequest } from "@/types/api";
import type { ParsedPair } from "@/lib/parsePlainText";

function notes(pairs: ParsedPair[]) {
  return pairs.map((p) => ({
    ankiNoteId: null,
    fields: { Front: p.front, Back: p.back },
    tags: [] as string[],
  }));
}

// The save payload for POST /decks/import. sourceFilename is null — there's no
// originating file for pasted text.
export function plainTextToImportRequest(
  name: string,
  pairs: ParsedPair[],
): ImportDeckRequest {
  return {
    name: name.trim() || "Imported deck",
    subdeckPath: null,
    sourceFilename: null,
    noteTypes: [
      {
        ankiModelId: null,
        name: "Basic",
        cloze: false,
        fieldNames: ["Front", "Back"],
        frontFields: ["Front"],
        backFields: ["Back"],
        notes: notes(pairs),
      },
    ],
  };
}

// A parse-result shape so the same pasted cards can be browsed in FlashcardViewer
// after import, matching the .apkg flow.
export function plainTextToParsed(name: string, pairs: ParsedPair[]): ApkgParseResponse {
  const built = notes(pairs);
  return {
    filename: name.trim() || "Imported deck",
    collectionFile: "",
    schema: "plain-text",
    totalNotes: built.length,
    skippedNotes: 0,
    imageOnlyNotes: 0,
    noteTypes: [
      {
        id: 1,
        name: "Basic",
        cloze: false,
        fieldNames: ["Front", "Back"],
        frontFields: ["Front"],
        backFields: ["Back"],
        noteCount: built.length,
        notes: built,
      },
    ],
  };
}
