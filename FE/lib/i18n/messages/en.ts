import type { Catalogue } from "@/lib/i18n/translate";

/**
 * English — the source of truth for which keys exist.
 *
 * <p>Every other catalogue is typed as `CatalogueOf<typeof en>`, so **a missing or misspelled key
 * in a translation is a typecheck failure, not a string that quietly renders as "auth.logIn" in
 * production.** That is the whole reason this is a typed object rather than JSON.
 *
 * <p>Keys are namespaced by surface (`landing.`, `auth.`, `common.`). Flat rather than nested so a
 * key is greppable: seeing `t("auth.forgotPassword")` in a component and being able to find it
 * here with one search matters more than tidy nesting.
 *
 * <p>Scope note: this is the first slice — landing page and the auth modal. The other ~50 screens
 * follow once the approach has been looked at.
 */
export const en = {
  // ---- shared ----------------------------------------------------------------------------
  "common.logIn": "Log in",
  "common.signUp": "Sign up",
  "common.home": "Home →",
  "common.browseDecks": "Browse decks",
  "common.close": "Close",
  "common.or": "or",
  "common.privacy": "Privacy",
  "common.terms": "Terms",

  // ---- landing ---------------------------------------------------------------------------
  "landing.eyebrow": "Anki decks → multiple choice",
  "landing.headline": "Study your Anki decks",
  // Split from the headline because it is italic and accented in the markup, not a separate
  // sentence — translators need to see the two halves together to get the word order right.
  "landing.headlineAccent": "as quizzes.",
  "landing.lede":
    "Drop in a .apkg — or open a deck someone shared — and start a multiple-choice quiz in seconds. Every deck gets a free quiz, no account. Sign up for unlimited runs, your own question types, and progress that's saved.",
  "landing.feature.fields": "Auto-detects fields",
  "landing.feature.flashcards": "Flashcard study mode",
  "landing.feature.distractors": "Distractors from your own deck",
  "landing.uploaderFootnote": "Read every card and take one quiz free — no sign-up.",
  "landing.footerTagline": "— your Anki decks, as multiple-choice quizzes.",

  "landing.saveTitle": "Save your deck",
  "landing.saveDescription":
    "Nice work! Create an account (or log in) to review this deck and save it to your library.",
  "landing.saveLogIn": "Log in & continue",
  "landing.saveSignUp": "Sign up & continue",
  // Email confirmation sends a guest out of the app mid-import, so this answers the only
  // question they will have: "did I just lose my deck?"
  "landing.saveConfirmNotice":
    "Account created, and your deck is saved in this browser. Confirm your email — check spam too — then log in and we'll pick up where you left off.",

  // ---- auth modal ------------------------------------------------------------------------
  "auth.welcomeBack": "Welcome back",
  "auth.createAccount": "Create your account",
  "auth.resetHeading": "Reset your password",
  "auth.continueWithGoogle": "Continue with Google",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.username": "Username",
  "auth.usernameHint": "You can change this later.",
  "auth.emailPlaceholder": "you@example.com",
  "auth.forgotPassword": "Forgot your password?",
  "auth.backToLogIn": "← Back to log in",
  "auth.sendResetLink": "Send reset link",
  "auth.resetExplainer":
    "Enter the address you signed up with and we'll send you a link to set a new password.",
  "auth.working": "Just a moment…",
  "auth.genericError": "Something went wrong. Please try again.",

  // The agreement line. Split around the two links so the sentence can be reordered: Vietnamese
  // puts the condition first ("Khi tiếp tục…"), and a single glued string would force English
  // word order on it.
  // In-sentence forms of the two legal links. Deliberately NOT common.privacy/common.terms
  // lowercased: a nav label and a phrase inside a sentence are different strings, and
  // "privacy" is not "privacy policy".
  "auth.legalTermsLink": "terms",
  "auth.legalPrivacyLink": "privacy policy",
  "auth.legalPrefix": "By continuing you agree to our",
  "auth.legalMiddle": "and",
  "auth.legalSuffix": ". No spam, ever.",

  /**
   * ⚠ Wording is load-bearing, not decorative: it must say the same thing whether or not the
   * address has an account. A translation that helpfully adds "if you are registered" would
   * reopen the user-enumeration leak this sentence exists to close.
   */
  "auth.resetSent":
    "If that address has an account, a reset link is on its way. Check your inbox and your spam folder.",

  /** ⚠ A SUCCESS message — it must not read like a failure. See CONFIRM_EMAIL_MESSAGE. */
  "auth.confirmEmail":
    "Account created. Check your inbox for a confirmation link — and your spam folder — then log in.",

  // ---- settings --------------------------------------------------------------------------
  "settings.language": "Language",
  "settings.languageHint": "Applies to the interface. Your decks are never translated.",
} as const satisfies Catalogue;

export type MessageKey = keyof typeof en;
