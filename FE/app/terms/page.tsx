import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/siteUrl";
import {
  ContactLink,
  LegalList,
  LegalPage,
  LegalSection,
  LegalText,
} from "@/components/legal/LegalPage";

const title = "Terms of service";
const description =
  "The terms for using Quizanki: your account, who owns the decks you upload, what the AI features can and cannot be relied on for, and how the service may change.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/terms") },
  openGraph: { type: "website", title, description, url: absoluteUrl("/terms") },
  twitter: { card: "summary", title, description },
};

const linkClass =
  "font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent";

export default function TermsPage() {
  return (
    <LegalPage
      title={title}
      updated="26 October 2026"
      summary={
        <>
          Quizanki is a free study tool. Your decks stay yours, you are responsible for having the
          right to upload them, and because it is free and run by one person it comes with no
          guarantee of uptime — so keep your own copies of anything you care about.
        </>
      }
    >
      <LegalSection heading="What Quizanki is">
        <LegalText>
          Quizanki turns Anki decks into multiple-choice quizzes, flashcards, practice tests and
          matching games. You can upload an <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.8em] text-ink">.apkg</code>{" "}
          file, build a deck by hand, generate one with AI, or study a deck somebody has shared.
          Using it means accepting these terms.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Your account">
        <LegalText>
          You need to be at least 13 to have an account. Use an email address you actually control,
          keep your password to yourself, and tell us at <ContactLink /> if you think somebody else
          has got into your account. You are responsible for what happens under it.
        </LegalText>
        <LegalText>
          Your username is public and credits any deck you share. It should not impersonate somebody
          else or be chosen to mislead.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Your decks stay yours">
        <LegalText>
          You keep ownership of everything you upload or create. By using Quizanki you give
          permission to store it, process it and show it back to you — and, if you choose to share a
          deck publicly, to show it to other people and let them study or copy it. That permission
          exists so the product can function; it is not a transfer of ownership, and it ends for
          anything you delete.
        </LegalText>
        <LegalText>
          Sharing a deck is a decision you make per deck, and it is not easily undone: once somebody
          has copied a public deck, their copy is theirs. Think of making a deck public as
          publishing it.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Only upload what you have the right to">
        <LegalText>
          Anki decks circulate widely and plenty of them contain material somebody else owns —
          textbook content, exam questions, images, audio. You are responsible for having the right
          to upload what you upload, and especially for having the right to share it publicly.
        </LegalText>
        <LegalText>
          If you believe something here infringes your copyright, email <ContactLink /> with a link
          to the deck and a description of the work. Material that clearly infringes will be
          removed.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Using it fairly">
        <LegalText>Please do not:</LegalText>
        <LegalList>
          <li>upload anything illegal, abusive, hateful, or sexual content involving minors;</li>
          <li>
            try to break, overload or work around the limits on the service — rate limits, upload
            sizes and AI quotas exist because this runs on free infrastructure shared by everybody
            using it;
          </li>
          <li>scrape the site in bulk, or automate account creation;</li>
          <li>
            attempt to reach other people&apos;s private decks, accounts or study records, or probe
            the service for vulnerabilities without asking first.
          </li>
        </LegalList>
        <LegalText>
          Accounts that do these things can be suspended. If yours is suspended you will be told the
          reason when you sign in, and you can reply to it at <ContactLink />.
        </LegalText>
      </LegalSection>

      <LegalSection heading="The AI features are a starting point, not an authority">
        <LegalText>
          AI-generated cards and explanations are produced by a language model and{" "}
          <strong className="font-medium text-ink">can be confidently wrong.</strong> Always check
          them against your source before you learn from them, and do not rely on them for anything
          medical, legal, financial or otherwise consequential. Generated cards land in an editor
          before they are saved precisely so you can read them first.
        </LegalText>
        <LegalText>
          The free AI quota is shared between everybody using Quizanki and can run out, change size,
          or be withdrawn. Do not build a routine that depends on it. See the{" "}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>{" "}
          for what happens to text you send to these features — it matters, and it is short.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Availability — and keeping your own copies">
        <LegalText>
          Quizanki is free and provided as it is, with no guarantee of uptime, no support
          commitment, and no promise that any particular feature will keep existing. It runs on free
          hosting tiers; the server sleeps when idle and can be slow to wake.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            So keep your own copies of decks that matter to you.
          </strong>{" "}
          Quizanki can export any deck back out as an Anki{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.8em] text-ink">.apkg</code> file
          from <Link href="/export" className={linkClass}>Make a quiz deck</Link>, and that export
          is yours to keep. Data loss is unlikely but no backup arrangement is promised here.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Ending it">
        <LegalText>
          You can stop using Quizanki whenever you like, and you can have your account and data
          deleted by emailing <ContactLink /> — the{" "}
          <Link href="/privacy" className={linkClass}>
            privacy policy
          </Link>{" "}
          explains what that covers. Accounts may be suspended or closed for breaking these terms,
          and the service itself may be discontinued; if that happens, reasonable notice will be
          given in the app so you can export your decks.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Liability">
        <LegalText>
          To the extent the law allows, Quizanki is provided without warranties of any kind, and
          the developer is not liable for lost data, lost study time, or any indirect or
          consequential loss arising from using it. Nothing here is intended to limit rights you
          have that cannot legally be limited.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <LegalText>
          These terms can change; the date at the top changes with them, and a material change will
          be flagged in the app rather than slipped in quietly. Continuing to use Quizanki after a
          change means accepting the updated terms.
        </LegalText>
        <LegalText>
          Questions about any of this: <ContactLink />.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
