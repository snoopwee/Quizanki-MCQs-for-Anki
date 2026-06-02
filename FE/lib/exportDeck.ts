// Deck export formats. Two are produced entirely client-side here:
//   - Delimited (CSV / TSV): one row per note, columns = the note type's fields
//     (+ optional Tags). Field-faithful so it re-imports into Anki or opens in a
//     spreadsheet. Heterogeneous decks (more than one note type) are emitted as
//     separate blocks, each prefixed with a `# <type>` comment line.
//   - Plain text (Quizlet-style): term<sep>definition rows, where term/definition
//     mirror the flashcard front/back the user actually studies. The two
//     separators are caller-chosen, matching Quizlet's export dialog.
// The third format (.apkg) is assembled on the backend — see useExportApkg.

import type { DeckContentsResponse } from "@/types/api";
import type { Flashcard } from "@/lib/flashcards";

export type CsvDelimiter = "," | "\t";

// RFC 4180-style quoting: wrap in double quotes when the value contains the
// delimiter, a quote, or a newline, and double any embedded quotes. Anki's
// CSV/TSV importer understands the same convention.
function escapeCell(value: string, delimiter: string): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildDelimited(
  contents: DeckContentsResponse,
  opts: { delimiter: CsvDelimiter; includeTags: boolean },
): string {
  const multipleTypes = contents.noteTypes.length > 1;
  const blocks: string[] = [];

  for (const nt of contents.noteTypes) {
    const headers = [...nt.fieldNames];
    if (opts.includeTags) headers.push("Tags");

    const lines: string[] = [];
    // Name each block only when the deck mixes note types, so a single-type
    // deck stays a clean importable CSV with no stray comment line.
    if (multipleTypes) lines.push(`# ${nt.name}`);
    lines.push(headers.map((h) => escapeCell(h, opts.delimiter)).join(opts.delimiter));

    for (const note of nt.notes) {
      const cells = nt.fieldNames.map((f) => note.fields[f] ?? "");
      if (opts.includeTags) cells.push((note.tags ?? []).join(" "));
      lines.push(cells.map((c) => escapeCell(c, opts.delimiter)).join(opts.delimiter));
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n") + "\n";
}

// Quizlet-style text. No escaping by design — like Quizlet, the user picks
// separators that don't collide with their content. Multi-field fronts/backs are
// joined with a single space so each card stays on one logical row.
export function buildQuizletText(
  cards: Flashcard[],
  opts: { termDelimiter: string; rowDelimiter: string },
): string {
  return cards
    .map((c) => `${c.front.join(" ")}${opts.termDelimiter}${c.back.join(" ")}`)
    .join(opts.rowDelimiter);
}

// Turns a user-typed delimiter into its literal characters, so someone can type
// `\n` or `\t` in a custom-separator box and get a real newline/tab.
export function interpretEscapes(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

// Filesystem-safe filename stem from the deck name (no extension).
export function exportFilename(deckName: string): string {
  const stem = deckName.trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
  return stem.length > 0 ? stem : "deck";
}

// Triggers a browser download of in-memory text. `withBom` prepends a UTF-8 BOM
// so Excel reads non-Latin (e.g. Japanese) CSV cells correctly.
export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
  withBom = false,
): void {
  const blob = new Blob([withBom ? "﻿" + content : content], {
    type: `${mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
