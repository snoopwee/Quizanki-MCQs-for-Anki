// Pure display helpers for AI generation — what to tell the learner when it works, when the
// allowance runs out, and when the provider doesn't answer.

import axios from "axios";
import type { AiDeckDraftMeta, AiKeyOwner } from "@/types/api";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { Vars } from "@/lib/i18n/translate";

/** Mirrors the backend's PDF cap so an oversized file is refused before it's uploaded. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * The backend's own message when there is one — it already says the useful thing ("you've used
 * today's 5 free generations", "that PDF looks like a scan"). The fallbacks only cover a response
 * that never reached our handler.
 */
export function aiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    const status = err.response?.status;
    if (status === 429) return "You've used today's AI generations. Try again tomorrow.";
    if (status === 503) return "AI generation isn't available right now.";
    if (status === 413) return "That file is too large.";
    if (!err.response) return "Couldn't reach the server. Check your connection and try again.";
  }
  return "Couldn't generate cards from that. Try different material.";
}

/**
 * How much of today's allowance is left, as a key.
 *
 * <p>Two keys rather than one with a spliced "free": English puts the adjective before the noun
 * and Vietnamese does not, so a shared template would force one language's word order.
 */
export function remainingCaption(
  remaining: number,
  keyOwner: AiKeyOwner,
): { key: MessageKey; vars: Vars } {
  return {
    key: keyOwner === "user" ? "aiGen.remainingOwnKey" : "aiGen.remainingShared",
    vars: { count: remaining },
  };
}

/** Caveats worth showing beside a finished draft — empty when it all went cleanly. */
export function draftNotes(meta: AiDeckDraftMeta): MessageKey[] {
  const notes: MessageKey[] = [];
  if (meta.inputTruncated) notes.push("aiGen.inputTruncated");
  if (meta.partial) notes.push("aiGen.partialRun");
  return notes;
}

/** Client-side PDF check, so an obvious mistake doesn't cost an upload. */
export function pdfFileError(
  file: File,
  maxBytes = MAX_PDF_BYTES,
): { key: MessageKey; vars?: Vars } | null {
  const looksLikePdf =
    file.type.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) return { key: "aiGen.notAPdf" };
  if (file.size === 0) return { key: "aiGen.emptyFile" };
  if (file.size > maxBytes) {
    return {
      key: "aiGen.pdfTooLarge",
      vars: { limit: Math.round(maxBytes / 1024 / 1024) },
    };
  }
  return null;
}

/**
 * Either a key we can translate, or text we cannot.
 *
 * <p>⚠ **The backend's own message wins, and the backend has no locale.** It says the genuinely
 * useful thing ("you've used today's 5 free generations", "that PDF looks like a scan"), so
 * replacing it with a vaguer translated sentence would be a downgrade — but it does mean a
 * Vietnamese reader sees an English sentence for those cases. Translating them properly means
 * giving the API an `Accept-Language`, which is a backend change, not a catalogue entry.
 */
export type AiErrorText = { key: MessageKey } | { text: string };

/** {@link aiErrorMessage}, but translatable wherever the message is ours rather than the API's. */
export function aiErrorKey(err: unknown): AiErrorText {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return { text: message };
    const status = err.response?.status;
    if (status === 429) return { key: "aiError.quota" };
    if (status === 503) return { key: "aiError.unavailable" };
    if (status === 413) return { key: "aiError.tooLarge" };
    if (!err.response) return { key: "aiError.offline" };
  }
  return { key: "aiError.generic" };
}
