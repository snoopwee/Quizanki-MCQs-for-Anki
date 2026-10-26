import type { ReactNode } from "react";
import { AppChrome } from "@/components/layout/AppChrome";

/**
 * Frame for the two legal pages.
 *
 * <p>Server components, unlike most public pages here: they are static prose with no session of
 * their own, so they can export `metadata` directly instead of needing a sibling `layout.tsx` the
 * way the client-component pages do.
 *
 * <p>Narrower than the app's usual width on purpose — `max-w-3xl` keeps a line of body text near
 * 70–80 characters, which is the difference between a policy somebody skims and one they bounce
 * off. The chrome is still {@link AppChrome}, because these have to open for a signed-out visitor
 * (Google fetches the privacy policy before anybody has an account) while still looking like part
 * of the app to someone signed in.
 */
export function LegalPage({
  title,
  updated,
  summary,
  children,
}: {
  title: string;
  updated: string;
  /** One plain sentence above the fold, for the majority who will not read the rest. */
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppChrome>
      <article className="mx-auto max-w-3xl pb-20">
        <header className="border-b border-line pb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-wide text-faint">Last updated {updated}</p>
          <p className="mt-4 text-sm leading-relaxed text-ink">{summary}</p>
        </header>

        <div className="mt-8 space-y-9">{children}</div>
      </article>
    </AppChrome>
  );
}

/** One titled section of a policy. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{heading}</h2>
      {children}
    </section>
  );
}

/** Body copy. A plain `<p>` everywhere would drift in colour and leading between pages. */
export function LegalText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted">{children}</p>;
}

/** A bulleted list inside a section, matching {@link LegalText}'s colour and leading. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">{children}</ul>
  );
}

/** `mailto:` for the contact address, so the two pages cannot disagree about it. */
export const CONTACT_EMAIL = "quizankisupport@gmail.com";

export function ContactLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent"
    >
      {CONTACT_EMAIL}
    </a>
  );
}
