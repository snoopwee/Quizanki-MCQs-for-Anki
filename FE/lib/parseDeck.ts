// Parses an Anki "Notes in Plain Text" export into structured notes.
//
// Anki exports are separator-delimited (tab by default) with optional `#` header
// lines declaring the separator and which column holds tags. Fields containing the
// separator, quotes, or newlines are wrapped in double quotes with `""` escaping.

export interface ParsedNote {
  fields: Record<string, string>;
  tags: string[];
}

export interface ParseResult {
  notes: ParsedNote[];
  fieldNames: string[];
}

const SEPARATOR_WORDS: Record<string, string> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
  space: " ",
  pipe: "|",
  colon: ":",
};

interface Header {
  separator: string;
  tagsColumn: number | null; // 1-based, or null
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseHeaders(lines: string[]): { header: Header; bodyStart: number } {
  const header: Header = { separator: "\t", tagsColumn: null };
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#")) break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(1, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "separator") {
      header.separator = SEPARATOR_WORDS[value.toLowerCase()] ?? (value.length === 1 ? value : "\t");
    } else if (key === "tags column" || key === "tags") {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n) && n > 0) header.tagsColumn = n;
    }
  }
  return { header, bodyStart: i };
}

// CSV-style tokenizer honoring quoted fields with embedded separators/newlines.
function tokenize(body: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanField(raw: string): string {
  return decodeEntities(
    raw
      .replace(/\[sound:[^\]]*\]/g, "")
      .replace(/<[^>]*>/g, ""),
  ).trim();
}

export function parseDeck(input: string): ParseResult {
  const text = stripBom(input).replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const { header, bodyStart } = parseHeaders(lines);

  const body = lines.slice(bodyStart).join("\n");
  const rawRows = tokenize(body, header.separator);

  // Determine the number of field columns (excluding the tags column).
  const tagsIdx = header.tagsColumn ? header.tagsColumn - 1 : -1;
  const fieldColumnCount = rawRows.reduce((max, cols) => {
    const count = tagsIdx >= 0 ? cols.length - (cols.length > tagsIdx ? 1 : 0) : cols.length;
    return Math.max(max, count);
  }, 0);

  const fieldNames = Array.from({ length: Math.max(fieldColumnCount, 0) }, (_, i) => `Field ${i + 1}`);

  const notes: ParsedNote[] = [];
  for (const cols of rawRows) {
    const fieldCols: string[] = [];
    let tags: string[] = [];
    for (let c = 0; c < cols.length; c++) {
      if (c === tagsIdx) {
        tags = cleanField(cols[c]).split(/\s+/).filter(Boolean);
      } else {
        fieldCols.push(cols[c]);
      }
    }

    const fields: Record<string, string> = {};
    let nonEmpty = 0;
    fieldCols.forEach((value, idx) => {
      const name = fieldNames[idx] ?? `Field ${idx + 1}`;
      const cleaned = cleanField(value);
      fields[name] = cleaned;
      if (cleaned.length > 0) nonEmpty++;
    });

    // A usable note needs at least a question and an answer.
    if (nonEmpty < 2) continue;
    notes.push({ fields, tags });
  }

  return { notes, fieldNames };
}
