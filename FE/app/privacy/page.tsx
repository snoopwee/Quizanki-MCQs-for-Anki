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

const title = "Privacy policy";
const description =
  "What Quizanki collects, what stays private, who processes it, and how to have your account and data deleted.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/privacy") },
  openGraph: { type: "website", title, description, url: absoluteUrl("/privacy") },
  twitter: { card: "summary", title, description },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title={title}
      updated="26 October 2026"
      summary={
        <>
          Quizanki stores the decks you upload, what you got right and wrong, and the email address
          you signed up with. Your email address is never shown to anyone else. There is no
          advertising and no third-party analytics or tracking.
        </>
      }
    >
      <LegalSection heading="Who runs Quizanki">
        <LegalText>
          Quizanki is a study tool for turning Anki decks into quizzes, run by an individual
          developer rather than a company. For anything in this policy, including a request to see
          or delete your data, write to <ContactLink />.
        </LegalText>
      </LegalSection>

      <LegalSection heading="What is collected">
        <LegalText>
          <strong className="font-medium text-ink">Your account.</strong> Your email address, the
          username you choose, and a password which is stored only as a cryptographic hash — never
          in a form anyone can read, including us. If you sign in with Google instead, Google gives
          us your name, email address and profile picture; we never see your Google password.
          Optionally, an avatar image if you upload one.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">What you put in.</strong> The decks you upload or
          create: deck names, cards, fields, tags, and any images or audio inside them.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">How you study.</strong> Which answers you got
          right and wrong, when, and in which session; which cards you have starred; which days you
          studied, to draw the streak; your folders, deck ratings, and who you follow.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">Technical records.</strong> Your IP address and
          browser user-agent, recorded with requests. These are used to apply rate limits and to
          investigate abuse and errors, not to build a profile of you.
        </LegalText>
      </LegalSection>

      <LegalSection heading="What is public and what is not">
        <LegalText>
          This is the part worth reading twice, because it is the part that is visible to other
          people:
        </LegalText>
        <LegalList>
          <li>
            <strong className="font-medium text-ink">Your email address is always private.</strong>{" "}
            It is never shown on your profile, on a deck, or to another user.
          </li>
          <li>
            <strong className="font-medium text-ink">Your username is public.</strong> It is the
            name that credits any deck you share, and your profile page is public.
          </li>
          <li>
            <strong className="font-medium text-ink">A deck is private until you share it.</strong>{" "}
            A deck you mark public can be opened, studied and copied by anyone with the link,
            including people who are not signed in.
          </li>
          <li>
            <strong className="font-medium text-ink">Ratings are public; written feedback is not.</strong>{" "}
            A star rating counts towards a deck&apos;s public score. Any note you write with it is
            shown only to that deck&apos;s author, without your name attached.
          </li>
          <li>
            <strong className="font-medium text-ink">Your study record is yours.</strong> Scores,
            streaks, starred cards and folders are visible only to you. Follower and following lists
            are visible only to the person they belong to.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="AI features, and what happens to text you send them">
        <LegalText>
          Generating a deck from text or a PDF, and the &ldquo;Explain this card&rdquo; button, send
          that content to Google&apos;s Gemini API to produce a result.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            Be aware that content sent through the free shared quota may be used by Google to
            improve their models, and may be reviewed by humans there.
          </strong>{" "}
          So do not paste anything confidential into the AI features. If you supply your own Gemini
          API key instead, the request goes under your key and Google&apos;s terms for your own
          account apply.
        </LegalText>
        <LegalText>
          Generated explanations are cached, keyed by a hash of the card&apos;s own text, so that
          the same card does not have to be sent again. That cache holds the card text and the
          explanation, and nothing about who asked.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Who else processes your data">
        <LegalText>
          Quizanki does not sell your data and does not share it for advertising. It is handled by
          the services that run the product:
        </LegalText>
        <LegalList>
          <li>
            <strong className="font-medium text-ink">Supabase</strong> — accounts and sign-in, the
            database, and storage for images and audio. Hosted in Singapore.
          </li>
          <li>
            <strong className="font-medium text-ink">Render</strong> — runs the application server.
          </li>
          <li>
            <strong className="font-medium text-ink">Vercel</strong> — serves the website.
          </li>
          <li>
            <strong className="font-medium text-ink">Cloudflare</strong> — DNS for the domain.
          </li>
          <li>
            <strong className="font-medium text-ink">Resend</strong> — sends account emails such as
            password resets and confirmations.
          </li>
          <li>
            <strong className="font-medium text-ink">Google</strong> — the Gemini API for the AI
            features above, and Google sign-in if you use it.
          </li>
        </LegalList>
        <LegalText>
          Data may also be disclosed if we are legally required to, or where it is necessary to
          investigate abuse or protect the service and its users.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Cookies and what is kept in your browser">
        <LegalText>
          Quizanki sets cookies for one purpose: keeping you signed in. There are no advertising
          cookies and no third-party analytics or tracking scripts, so there is nothing to opt out
          of.
        </LegalText>
        <LegalText>
          Some things are stored in your browser and never sent to us: an unsaved import you are
          part-way through, your theme and text-size settings, and — if you are using Quizanki
          without an account — the progress of your trial quiz.
        </LegalText>
      </LegalSection>

      <LegalSection heading="How long it is kept">
        <LegalText>
          Your account and the decks in it are kept until you ask for them to be deleted. Study
          records are kept for as long as the account exists, because they are what the streak and
          progress figures are made of. Notifications are cleared out automatically after a while.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Seeing, correcting or deleting your data">
        <LegalText>
          You can edit or delete any deck, and change your username, email address, password and
          avatar, from inside the app at any time.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            To delete your whole account, email <ContactLink /> from the address you signed up with
          </strong>{" "}
          and say that you want it deleted. It will be removed, along with your decks, uploaded
          media and study records, within 30 days. A self-service button for this is not built yet,
          which is exactly why the email route exists — the request is honoured either way. The same
          address will get you a copy of your data if you want one.
        </LegalText>
        <LegalText>
          One thing deletion cannot reach: if you shared a deck publicly and somebody else copied it
          to their own library, their copy is their data now and stays with them.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Children">
        <LegalText>
          Quizanki is not intended for children under 13, and accounts should not be created for
          them. If you believe a child has created an account, email <ContactLink /> and it will be
          removed.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <LegalText>
          If this policy changes, the date at the top changes with it. Anything that materially
          affects what is collected or who it goes to will be flagged in the app rather than
          slipped in quietly.
        </LegalText>
        <LegalText>
          See also the <Link href="/terms" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent">terms of service</Link>.
        </LegalText>
      </LegalSection>
    </LegalPage>
  );
}
