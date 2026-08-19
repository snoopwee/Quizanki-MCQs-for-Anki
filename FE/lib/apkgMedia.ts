// Client-side extractor for a single media clip out of an .apkg (a ZIP), so the
// import review can PLAY a card's audio before it's uploaded to storage. The whole
// file is read once, its central directory parsed, and one entry inflated on demand
// (.apkg media is DEFLATE — method 8 — decompressed via DecompressionStream). Blob
// URLs are cached and can be revoked when the review is left.
//
// Only used for review-time preview; the real import still streams the clips to
// storage server-side at save (see cardAudioImport / ApkgAudioImportService).

const TEXT = new TextDecoder();

interface ZipEntry {
  offset: number; // local file header offset
  compSize: number;
  method: number; // 0 = stored, 8 = deflate
}

function mimeForFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "webm":
      return "audio/webm";
    default:
      return "audio/mpeg"; // mp3 and anything else
  }
}

export class ApkgMedia {
  private readonly file: File;
  private buf: ArrayBuffer | null = null;
  private entries: Map<string, ZipEntry> | null = null;
  private numberByFilename: Map<string, string> | null = null;
  private readonly urlCache = new Map<string, string>();

  constructor(file: File) {
    this.file = file;
  }

  // A playable blob URL for the given media filename, or null if it's not in the
  // archive / can't be decompressed here.
  async clipUrl(filename: string): Promise<string | null> {
    const cached = this.urlCache.get(filename);
    if (cached) return cached;
    await this.load();
    const num =
      this.numberByFilename!.get(filename) ??
      this.numberByFilename!.get(safeDecode(filename));
    if (num == null) return null;
    const bytes = await this.readEntry(num);
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeForFilename(filename) }));
    this.urlCache.set(filename, url);
    return url;
  }

  // Free every blob URL handed out — call when the review is discarded/saved.
  revoke(): void {
    for (const url of this.urlCache.values()) URL.revokeObjectURL(url);
    this.urlCache.clear();
  }

  private async load(): Promise<void> {
    if (this.buf) return;
    this.buf = await this.file.arrayBuffer();
    this.entries = parseCentralDirectory(this.buf);
    this.numberByFilename = new Map();
    const manifest = await this.readEntry("media");
    if (manifest) {
      try {
        const map = JSON.parse(TEXT.decode(manifest)) as Record<string, string>;
        for (const [num, name] of Object.entries(map)) this.numberByFilename.set(name, num);
      } catch {
        // A non-JSON (newest protobuf) manifest just means no client-side preview.
      }
    }
  }

  private async readEntry(name: string): Promise<Uint8Array<ArrayBuffer> | null> {
    if (!this.buf || !this.entries) return null;
    const e = this.entries.get(name);
    if (!e) return null;
    const dv = new DataView(this.buf);
    // Local file header is 30 fixed bytes + filename + extra, then the data.
    const nameLen = dv.getUint16(e.offset + 26, true);
    const extraLen = dv.getUint16(e.offset + 28, true);
    const dataStart = e.offset + 30 + nameLen + extraLen;
    if (dataStart + e.compSize > this.buf.byteLength) return null;
    const comp = new Uint8Array(this.buf, dataStart, e.compSize);
    if (e.method === 0) return comp;
    if (e.method === 8) return inflateRaw(comp);
    return null;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Parse a ZIP's central directory into name → {local offset, compressed size,
// method}. No ZIP64 handling — an .apkg is well under 4 GB and 65 535 entries.
function parseCentralDirectory(buf: ArrayBuffer): Map<string, ZipEntry> {
  const dv = new DataView(buf);
  const map = new Map<string, ZipEntry>();
  // Find the End Of Central Directory record (0x06054b50) scanning back from the
  // end (past the max 64 KB comment).
  let eocd = -1;
  const min = Math.max(0, buf.byteLength - 22 - 65536);
  for (let i = buf.byteLength - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return map;
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // central directory offset
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.byteLength || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = TEXT.decode(new Uint8Array(buf, p + 46, nameLen));
    map.set(name, { offset: localOffset, compSize, method });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

async function inflateRaw(comp: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}
