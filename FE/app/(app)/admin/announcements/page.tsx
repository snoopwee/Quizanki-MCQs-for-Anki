"use client";

import { useState } from "react";
import { useAnnouncementAudience, useSendAnnouncement } from "@/hooks/useAdmin";
import { Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/shared/Toast";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import {
  announcementProblem,
  confirmQuestion,
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
  sentSummary,
  type AnnouncementAudience,
} from "@/lib/announcementDisplay";

const inputClasses =
  "focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint";

// Broadcast a notification. A send writes one row per recipient and there is no way to un-send, so
// the flow is: compose → a confirm that names the real number of people → the backend's own count
// of what went out. "Just me" exists so a wording can be checked in the bell before everyone sees it.
export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("me");
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Only asked for once "Everyone" is picked — a test send has no business counting users.
  const recipients = useAnnouncementAudience(audience === "all");
  const send = useSendAnnouncement();

  const problem = announcementProblem({ title, body, link });

  function submit() {
    setToast(null);
    send.mutate(
      {
        title: title.trim(),
        body: body.trim() || null,
        link: link.trim() || null,
        audience,
      },
      {
        onSuccess: (result) => {
          setConfirming(false);
          setToast({
            kind: "success",
            message: sentSummary(result.audience, result.recipients, result.sent),
          });
          // Keep the draft: a test send is usually followed by the real one.
          if (result.audience === "all") {
            setTitle("");
            setBody("");
            setLink("");
          }
        },
        onError: () => {
          setConfirming(false);
          setToast({ kind: "error", message: "Couldn't send that. Try again." });
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-muted">
          Sends a notification to people&apos;s bells. One row per person, and there&apos;s no
          un-send — so try it on yourself first.
        </p>
      </header>

      <section className="space-y-4 rounded-card border border-line bg-surface p-5">
        <div className="space-y-1.5">
          <label htmlFor="ann-title" className="block text-xs font-medium text-muted">
            Title
          </label>
          <input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_ANNOUNCEMENT_TITLE}
            placeholder="Folders are here"
            className={inputClasses}
          />
          <p className="text-right font-mono text-[0.6875rem] text-faint">
            {title.length}/{MAX_ANNOUNCEMENT_TITLE}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ann-body" className="block text-xs font-medium text-muted">
            Message <span className="text-faint">(optional)</span>
          </label>
          <textarea
            id="ann-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_ANNOUNCEMENT_BODY}
            rows={3}
            placeholder="Group your decks into folders from Home — a deck can sit in several."
            className={`${inputClasses} resize-y`}
          />
          <p className="text-right font-mono text-[0.6875rem] text-faint">
            {body.length}/{MAX_ANNOUNCEMENT_BODY}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ann-link" className="block text-xs font-medium text-muted">
            Opens <span className="text-faint">(optional, in-app path)</span>
          </label>
          <input
            id="ann-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/home"
            className={inputClasses}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">Send to</span>
          <Segmented
            options={[
              { value: "me", label: "Just me" },
              { value: "all", label: "Everyone" },
            ]}
            value={audience}
            onChange={(v) => {
              setAudience(v as AnnouncementAudience);
              setConfirming(false);
            }}
          />
          {audience === "all" && (
            <p className="flex items-center gap-1.5 pt-0.5 text-xs text-muted">
              {recipients.isLoading ? (
                <>
                  <Spinner className="h-3 w-3 text-accent" /> Counting people…
                </>
              ) : recipients.isError ? (
                <>
                  <Icon name="alertTriangle" size={13} className="text-danger" />
                  <span className="text-danger">Couldn&apos;t count the audience.</span>
                </>
              ) : (
                <>
                  <Icon name="user" size={13} />
                  {recipients.data === 1 ? "1 person" : `${recipients.data} people`} will get this.
                </>
              )}
            </p>
          )}
        </div>

        {problem && (
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <Icon name="alertTriangle" size={14} className="mt-0.5 shrink-0" />
            {problem}
          </p>
        )}

        {confirming ? (
          <div className="space-y-2 rounded-input border border-accent/40 bg-accent-soft p-3">
            <p className="text-sm font-semibold text-accent-ink">
              {confirmQuestion(audience, recipients.data)}
            </p>
            <p className="text-xs text-accent-ink/80">This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={send.isPending}
                className={buttonClasses({ variant: "primary", size: "sm" })}
              >
                {send.isPending && <Spinner className="h-3.5 w-3.5 text-white" label="Sending" />}
                Yes, send it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={Boolean(problem) || send.isPending}
            className={buttonClasses({ variant: "primary" })}
          >
            <Icon name="bell" size={16} />
            {audience === "all" ? "Send to everyone" : "Send to me"}
          </button>
        )}
      </section>

      <p className="text-xs text-muted">
        Announcements land in the bell in the top bar and stay for 90 days. They&apos;re separate
        from the site-wide banner in{" "}
        <span className="font-medium text-ink">Site config</span>, which every visitor sees at the
        top of the page.
      </p>

      {toast && (
        <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
