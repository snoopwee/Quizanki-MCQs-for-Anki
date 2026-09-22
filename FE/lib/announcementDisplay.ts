// Pure helpers for the admin broadcast form: the same limits the backend enforces, said out loud
// before the request rather than as a 400 afterwards.

import { inAppHref } from "@/lib/notificationDisplay";

/** Mirrors NotificationService.MAX_TITLE / MAX_BODY and the AnnouncementRequest caps. */
export const MAX_ANNOUNCEMENT_TITLE = 120;
export const MAX_ANNOUNCEMENT_BODY = 500;

export type AnnouncementAudience = "all" | "me";

export interface AnnouncementDraft {
  title: string;
  body: string;
  link: string;
}

/**
 * Why Send is disabled, or null when the draft is fine. One message at a time, in the order the
 * admin would fix them.
 */
export function announcementProblem(draft: AnnouncementDraft): string | null {
  const title = draft.title.trim();
  if (!title) return "A title is needed — it's the line people see in the bell.";
  if (title.length > MAX_ANNOUNCEMENT_TITLE) {
    return `The title is ${title.length - MAX_ANNOUNCEMENT_TITLE} characters too long.`;
  }
  if (draft.body.trim().length > MAX_ANNOUNCEMENT_BODY) {
    return `The message is ${draft.body.trim().length - MAX_ANNOUNCEMENT_BODY} characters too long.`;
  }
  // An empty link is fine; a link that would leave the app is not — the backend refuses it too.
  if (draft.link.trim() && !inAppHref(draft.link)) {
    return "A link must be an in-app path like /help or /discover.";
  }
  return null;
}

/** What the confirm step asks, with the real number of people in it. */
export function confirmQuestion(audience: AnnouncementAudience, recipients: number | undefined): string {
  if (audience === "me") return "Send this to yourself only?";
  if (recipients === undefined) return "Send this to everyone?";
  if (recipients === 1) return "Send this to 1 person?";
  return `Send this to all ${recipients} people?`;
}

/** What actually happened, from the backend's own counts. */
export function sentSummary(audience: string, recipients: number, sent: number): string {
  if (audience === "me") {
    return sent > 0
      ? "Sent to you — check the bell in the top bar."
      : "Nothing was sent.";
  }
  if (sent === 0) return "Nothing was sent — there were no recipients.";
  const people = sent === 1 ? "1 person" : `${sent} people`;
  // recipients > sent means some were dropped (a blank or duplicate id); say so rather than
  // quietly reporting the smaller number.
  const dropped = recipients - sent;
  if (dropped <= 0) return `Sent to ${people}.`;
  const skipped = dropped === 1 ? "1 recipient was skipped." : `${dropped} recipients were skipped.`;
  return `Sent to ${people}. ${skipped}`;
}
