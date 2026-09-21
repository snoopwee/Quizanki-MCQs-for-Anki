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

/** "1 deck" / "3 decks" — a folder with nothing in it still says "0 decks". */
export function deckCountLabel(count: number): string {
  return `${count} ${count === 1 ? "deck" : "decks"}`;
}

/** A folder name is what the user typed, trimmed; blank means "don't submit". */
export function normalizeFolderName(raw: string): string {
  return raw.trim();
}
