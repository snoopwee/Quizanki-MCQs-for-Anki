// Pure display helpers for AI generation — what to tell the learner when it works, when the
// allowance runs out, and when the provider doesn't answer.

import axios from "axios";
import type { AiDeckDraftMeta, AiKeyOwner } from "@/types/api";

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

/** "4 free generations left today" / "4 left today on your key". */
export function remainingCaption(remaining: number, keyOwner: AiKeyOwner): string {
  const plural = remaining === 1 ? "generation" : "generations";
  if (keyOwner === "user") return `${remaining} ${plural} left today on your key`;
  return `${remaining} free ${plural} left today`;
}

/** Caveats worth showing beside a finished draft — empty when it all went cleanly. */
export function draftNotes(meta: AiDeckDraftMeta): string[] {
  const notes: string[] = [];
  if (meta.inputTruncated) {
    notes.push("That material was long, so only the first part was used. Generate again from the rest to continue.");
  }
  if (meta.partial) {
    notes.push("The AI stopped partway, so these are the cards it managed. You can generate the rest separately.");
  }
  return notes;
}

/** Client-side PDF check, so an obvious mistake doesn't cost an upload. */
export function pdfFileError(file: File, maxBytes = MAX_PDF_BYTES): string | null {
  const looksLikePdf =
    file.type.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) return "That doesn't look like a PDF.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxBytes) {
    return `That PDF is larger than ${Math.round(maxBytes / 1024 / 1024)} MB. Try a single chapter.`;
  }
  return null;
}
