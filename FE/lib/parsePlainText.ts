// Quizlet-style plain-text import: split rows by a row delimiter, then each row
// into term/definition by a term delimiter. Mirrors the export separators and
// reuses interpretEscapes so a user can type "\n" / "\t" in the custom boxes.
// Blank rows are dropped; a row with no term delimiter keeps its whole text as
// the front (empty back).

import { interpretEscapes } from "@/lib/exportDeck";

export interface ParsedPair {
  front: string;
  back: string;
}

export function parsePlainText(
  text: string,
  opts: { termDelimiter: string; rowDelimiter: string },
): ParsedPair[] {
  const rowDelim = interpretEscapes(opts.rowDelimiter) || "\n";
  const termDelim = interpretEscapes(opts.termDelimiter) || "\t";

  const pairs: ParsedPair[] = [];
  for (const rawRow of text.split(rowDelim)) {
    if (rawRow.trim().length === 0) continue;
    const at = rawRow.indexOf(termDelim);
    if (at === -1) {
      pairs.push({ front: rawRow.trim(), back: "" });
    } else {
      pairs.push({
        front: rawRow.slice(0, at).trim(),
        back: rawRow.slice(at + termDelim.length).trim(),
      });
    }
  }
  return pairs;
}
