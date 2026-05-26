import type { ApkgParseResponse, ImportDeckRequest } from "@/types/api";

// Converts a parsed .apkg into the nested deck-import payload. Note types with no
// notes or no fields are dropped (the BE rejects empty ones). The deck name
// defaults to the filename without its .apkg extension.
export function parsedToImportRequest(parsed: ApkgParseResponse): ImportDeckRequest {
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
    noteTypes,
  };
}
