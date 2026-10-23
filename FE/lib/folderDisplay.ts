// Pure display helpers for folders — what to tell the user when a name clashes, and how a
// folder's size reads on a card.

import axios from "axios";

/**
 * The backend's own message when there is one: on a duplicate name it names the folder
 * ("You already have a folder called \"Japanese\"."), which is the whole point of showing an error
 * there. The fallback covers a response that never reached our handler.
 */
export function folderErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (!err.response) return "Couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}

/**
 * Is this the backend saying the folder isn't there?
 *
 * <p>Worth separating from any other failure because a folder now has its own URL: bookmark one,
 * delete it, come back, and a 404 is the *expected* answer, not a fault. "That folder is gone" and
 * "we couldn't reach the server" need different wording and different buttons. The backend answers
 * 404 rather than 403 for somebody else's folder too, so this covers both without leaking which.
 */
export function isMissingFolderError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

/** "1 deck" / "3 decks" — a folder with nothing in it still says "0 decks". */
export function deckCountLabel(count: number): string {
  return `${count} ${count === 1 ? "deck" : "decks"}`;
}

/** A folder name is what the user typed, trimmed; blank means "don't submit". */
export function normalizeFolderName(raw: string): string {
  return raw.trim();
}
