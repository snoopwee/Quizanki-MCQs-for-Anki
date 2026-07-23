// Local persistence for the unsaved import draft, so closing the tab, a crash, a
// flat battery or a dropped connection doesn't cost the user their editing work.
// The leave-warning modal only catches deliberate navigation — this is the net
// for everything else.
//
// IndexedDB rather than localStorage on purpose: a deck can hold up to 5,000
// cards (MAX_NOTES on the backend), and a large core deck serialises well past
// localStorage's ~5 MB ceiling. The users with the most to lose are exactly the
// ones a localStorage quota error would fail, silently, at the worst moment.
//
// Deliberately dependency-free — one database, one store, one record.

import type { EditorState } from "@/lib/deckEditor";

const DB_NAME = "quizanki";
const DB_VERSION = 1;
const STORE = "drafts";
// One draft at a time: the import screen only ever edits one deck.
const DRAFT_KEY = "import";

export interface StoredDraft {
  savedAt: number;
  state: EditorState;
  isPublic: boolean;
  sourceFilename: string | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Every entry point is best-effort: a browser in private mode, with storage
// disabled, or over quota must degrade to "no draft recovery", never to a broken
// import screen. Callers get null / a resolved promise instead of a throw.
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function saveDraft(draft: StoredDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft, DRAFT_KEY));
}

export async function loadDraft(): Promise<StoredDraft | null> {
  const draft = await withStore<StoredDraft>("readonly", (store) => store.get(DRAFT_KEY));
  // Guard against a record written by an older shape of this code.
  if (!draft || !draft.state || !Array.isArray(draft.state.rows)) return null;
  return draft;
}

export async function clearDraft(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(DRAFT_KEY));
}

/** "just now" / "12 minutes ago" / "2 hours ago" — for the Resume banner. */
export function describeAge(savedAt: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
