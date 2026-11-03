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

  // ---- uploading a deck -------------------------------------------------------------------
  "uploader.heading": "Import from an .apkg file",
  "uploader.dropzone": "Drop your .apkg here, or click to browse",
  "uploader.dropzoneHint": "Anki deck export · up to 50 MB",
  "uploader.reading": "Reading your deck…",
  "uploader.continue": "Continue →",
  "uploader.wrongType": "Please choose a .apkg file (an Anki deck export).",
  "uploader.parseFailed": "Could not parse the file. Please try a different .apkg.",
  "uploader.nothingQuizzable": "None of these note types look ready for a text quiz yet.",
  "uploader.needDeck": "Need a deck?",
  "uploader.browseShared": "Browse decks shared here",

  // ---- quiz --------------------------------------------------------------------------------
  "quiz.endQuiz": "End quiz",
  "quiz.settings": "Quiz settings",
  "quiz.typeMultipleChoice": "Multiple choice",
  "quiz.typeTrueFalse": "True / false",
  "quiz.explainAsk": "Why is this the answer?",
  "quiz.explainThinking": "Thinking…",

  // ---- results -----------------------------------------------------------------------------
  "results.complete": "Quiz complete",
  "results.praiseGreat": "Great work",
  "results.praiseKeepGoing": "Keep going",
  "results.praiseAnotherPass": "Worth another pass",
  "results.newQuiz": "New quiz",
  "results.retryMissed": "Retry missed",
  "results.reviewAnswers": "Review answers",

  "uploader.tooLarge": "That file is too large (limit {limit} MB).",
  "quiz.typeWritten": "Written",
  "quiz.mixedFormats": "mixed formats",
  "results.praiseOutstanding": "Outstanding",
  "results.correct": "Correct",
  "results.incorrect": "Incorrect",
  "results.accuracy": "Accuracy",
  "results.retake": "Retake",
  "results.missed": "Missed",

  // ---- quiz setup ---------------------------------------------------------------------------
  "setup.heading": "Set up a quiz",
  "setup.headingYour": "Set up your quiz",
  "setup.start": "Start quiz",
  "setup.howMany": "How many questions?",
  "setup.numberOfQuestions": "Number of questions",
  "setup.questionTypes": "Question types",
  "setup.questionTypesDesc": "Mix any combination — each card is asked in one of the enabled formats.",
  "setup.pullFrom": "Pull cards from",
  "setup.allCards": "All cards",
  "setup.stillLearning": "Still learning",
  "setup.clozeNoteTypes": "Cloze note types",
  "setup.pickAField": "Pick at least one question field for each note type you want to include.",
  "setup.fieldsHeading": "Question and answer fields",
  "setup.prefilled": "Pre-filled from the deck's card layout — adjust if needed.",
  "setup.detectionUnsure": "Detection is unsure — please check the question and answer fields.",
  "setup.questionLegend": "Question — shown on the card",
  "setup.questionHint": "Tick one or more fields to bundle into each prompt.",
  "setup.answerLabel": "Answer — the correct choice",

  // ---- flashcards ----------------------------------------------------------------------------
  "study.allMastery": "All mastery",
  "study.new": "New",
  "study.learning": "Learning",
  "study.practicing": "Practicing",
  "study.mastered": "Mastered",
  "study.front": "Front",
  "study.back": "Back",
  "study.clickToFlip": "Click to flip",
  "study.flipCard": "Flip card",
  "study.editCard": "Edit card",
  "study.editFields": "Edit fields",
  "study.know": "Know",
  "study.stillLearning": "Still learning",
  "study.gotIt": "Got it",
  "study.roundComplete": "Round complete",
  "study.youKnew": "You knew {known} of {total}",
  "study.knownCount": "{count} known",
  "study.previousCard": "Previous card",
  "study.nextCard": "Next card",
  "study.autoplay": "Autoplay",
  "study.pauseAutoplay": "Pause autoplay",
  "study.shuffle": "Shuffle",
  "study.shuffleOn": "Shuffle on",
  "study.flashcardsOptions": "Flashcards options",
  "study.focusMode": "Focus mode",
  "study.exitFullscreen": "Exit fullscreen",
  "study.exitFullscreenEsc": "Exit fullscreen (Esc)",
  "study.searchPlaceholder": "Search term or definition…",
  "study.searchCards": "Search cards",
  "study.clearSearch": "Clear search",
  "study.filterByMastery": "Filter by mastery",
  "study.cardSorting": "Card sorting",
  "study.exitSorting": "Exit sorting",
  "study.studying": "Studying",
  "study.showAll": "Show all",
  "study.showAllCount": "Show all ({count})",
  "study.showMore": "Show more",
  "study.deckCompletion": "Deck completion",
  "study.saveDeck": "Save deck",
  "study.importAnother": "Import another",
  "study.setUpQuiz": "Set up a quiz →",
  "study.keysHint": "Keys:",
  "study.restart": "Restart",
  "study.subsetStarred": "Starred",
  // Plural: English needs both forms, Vietnamese needs one. See lib/i18n/translate.ts.
  "study.cardCount": { one: "{count} card", other: "{count} cards" },
  "study.deckIntro": {
    one: "{count} card — study it, then set up a quiz.",
    other: "{count} cards — study them, then set up a quiz.",
  },

  "study.cardsInDeck": "Cards in this deck ({shown})",
  "study.cardsInDeckFiltered": "Cards in this deck ({shown} of {total})",
  "landing.startOver": "Start over",
  "landing.signUpToQuizAgain": "Sign up to quiz again →",
  "landing.startFreeQuiz": "Start the free quiz →",
  "landing.backToFlashcards": "Back to flashcards",
  "common.cancel": "Cancel",

  "study.keyPrev": "prev",
  "study.keyNext": "next",
  "study.keyFlip": "flip",
  "study.keyFocus": "focus",

  // ---- app shell / navigation -----------------------------------------------------------------
  "nav.home": "Home",
  "nav.discover": "Discover",
  "nav.folders": "Folders",
  "nav.importDeck": "Import deck",
  "nav.makeQuizDeck": "Make a quiz deck",
  "nav.newDeck": "New deck",
  "nav.admin": "Admin",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.pinSidebar": "Pin sidebar open",
  "nav.hoverMode": "Switch to hover mode",
  "nav.savingDeck": "Saving deck",
  "nav.savingDeckEllipsis": "Saving deck…",
  "nav.comingSoon": "Coming soon",

  // ---- home ---------------------------------------------------------------------------------
  "home.welcome": "Welcome back",
  "home.subtitle": "Pick up where you left off.",
  "home.avgCompletion": "Avg. completion",
  "home.quickActions": "Quick actions",
  "home.importTitle": "Import an Anki deck",
  "home.importDesc": "Drop an .apkg file and we'll turn every card into a multiple-choice quiz.",
  "home.quickQuizTitle": "Start a quick quiz",
  "home.quizThisDeck": "Quiz this deck",
  "home.newQuiz": "New quiz",
  "home.exploreTitle": "Explore shared decks",
  "home.exploreDesc": "Browse decks shared by other learners — Japanese, Spanish, and more.",
  "home.browseDiscover": "Browse Discover",
  "home.yourDecks": "Your decks",
  "home.tabSaved": "Saved",
  "home.tabRecent": "Recent",
  "home.noDecks": "No decks yet.",
  "home.importFirst": "Import your first deck",
  "home.noSaved": "No saved decks.",
  "home.noSavedHint": "Open a shared deck and hit \u201cSave to Home\u201d to keep it here.",
  "home.nothingRecent": "Nothing recent.",
  "home.nothingRecentHint": "Decks you open show up here for 30 days.",

  "home.decks": "Decks",
  "home.cardsTotal": { one: "{count} card total", other: "{count} cards total" },
  "home.acrossYourDecks": "across your decks",
  "home.studyStreak": "Study streak",
  "home.streakDays": { one: "{count} day", other: "{count} days" },
  "home.streakBest": "best {count}",
  "home.streakError": "Couldn't load your streak",
  "home.last7Days": "last 7 days",
  "home.studyDaysAria": "Your study days over the last 7 days",
  "home.today": "Today",
  "home.studied": "studied",
  "home.notStudied": "not studied",
  "streak.doneToday": "Done today",
  "streak.studyToday": "Study today",
  "streak.startToday": "Start today",

  "home.quickQuizFrom": "Multiple-choice test from {deck}.",
  "home.quickQuizNoDeck": "Import a deck first, then jump straight into a multiple-choice test.",

  // ---- deck card / rating -----------------------------------------------------------------
  "deck.loading": "Loading…",
  "deck.loadFailed": "Could not load decks.",
  "deck.cardCount": { one: "{count} card", other: "{count} cards" },
  "deck.by": "by",
  "deck.createdOn": "Created {date}",
  "deck.originalBy": "Original deck by {name}",
  "rating.notRated": "Not rated yet",
  "rating.count": { one: "{count} rating", other: "{count} ratings" },
  // Read aloud in place of five star glyphs, so it spells out what the glyphs mean.
  "rating.aria": "Rated {score} out of {max}, {caption}",

  // ---- discover -------------------------------------------------------------------------------
  "discover.metaTitle": "Browse shared decks",
  "discover.metaDescription":
    "Public Anki decks shared by the Quizanki community — study any of them as a quiz, flashcards or a matching game.",
  "discover.heading": "Discover decks",
  "discover.lede":
    "Decks people have shared. Open one to preview it, then save your own copy — you get your own cards and your own progress.",
  "discover.searchLabel": "Search shared decks",
  "discover.searchPlaceholder": "Search shared decks…",
  "discover.size": "Size",
  "discover.sort": "Sort",
  "discover.sortNewest": "Newest",
  "discover.sortBestRated": "Best rated",
  "discover.loading": "Loading decks…",
  "discover.loadFailed": "Couldn't load shared decks. Please try again.",
  "discover.noMatch": "No shared decks match your filters.",
  "discover.noneShared": "No decks have been shared yet.",
  "discover.noMatchHint": "Try a broader search or a different size.",
  "discover.noneSharedHint": "Import one of your own and set it to public — it'll show up here.",
  "discover.prev": "Prev",
  "discover.next": "Next",
  // Size buckets. The three numeric ones are deliberately identical in every language.
  "size.any": "Any size",
  "size.under20": "Under 20",
  "size.20to50": "20\u201350",
  "size.50to100": "50\u2013100",
  "size.100plus": "100+",

  // ---- deck page ------------------------------------------------------------------------------
  "deckPage.loading": "Loading deck…",
  "deckPage.notFound": "Deck not found.",
  "deckPage.backToDecks": "Back to decks",
  "deckPage.backToFlashcards": "Back to flashcards",
  "deckPage.breadcrumb": "Breadcrumb",
  "deckPage.studyModes": "Study modes",
  "deckPage.flashcards": "Flashcards",
  "deckPage.flashcardsDesc": "Flip through every card below",
  "deckPage.quizMe": "Quiz me",
  "deckPage.quizMeDesc": "Quiz me — Multiple choice",
  "deckPage.match": "Match",
  "deckPage.practiceTest": "Practice test",
  "deckPage.setUpQuiz": "Set up quiz",
  "deckPage.term": "Term",
  "deckPage.definition": "Def",
  "deckPage.edit": "Edit",
  "deckPage.duplicate": "Duplicate",
  "deckPage.export": "Export",
  "deckPage.delete": "Delete",
  "deckPage.deleteDeck": "Delete deck",
  "deckPage.deleteConfirm": "Delete this deck?",
  "deckPage.privateShare": "Private — share this deck",
  "deckPage.saveToHome": "Save to Home",
  "deckPage.savedToHome": "Saved to Home — remove",
  "deckPage.yourRating": "Your rating",
  "deckPage.deleting": "Deleting…",
  "deckPage.rateIt": "Rate it",
  "deckPage.report": "Report",

  // ---- shared deck ----------------------------------------------------------------------------
  "shared.heading": "Shared deck",
  "shared.notShared": "This deck isn't shared",
  "shared.backToDeck": "Back to deck",
  "shared.cardsInDeck": "Cards in this deck",
  "shared.studyThisDeck": "Study this deck",
  "shared.playMatch": "Play Match",
  "shared.startFreeQuiz": "Start the free quiz →",
  "shared.keepProgress": "Nice work — keep this progress",
  "shared.tryQuizanki": "Try Quizanki",
  "shared.createOneFree": "Create one free",

  // ---- folders ---------------------------------------------------------------------------------
  "folders.heading": "Folders",
  "folders.allYourDecks": "All your decks",
  "folders.allFolders": "All folders",
  "folders.pickADeck": "Pick a deck to file",
  "folders.gone": "That folder isn't there any more.",
  "folders.empty": "This folder is empty.",

  // ---- sign-up prompts on a shared deck -------------------------------------------------------
  // Why we are asking. Naming the thing the learner just tried to do converts better than one
  // generic "sign in to continue", and costs nothing but a string.
  "reason.studyDesc": "Create a free account (or log in) to study this deck and keep your progress.",
  "reason.againTitle": "Keep going on this deck",
  "reason.againDesc":
    "Free quizzes are one per deck. With an account you get unlimited runs, your own question types and card counts, and progress that's saved.",
  "reason.finishedDesc":
    "Your score for this run isn't saved yet. Create a free account to keep it, study this deck again, and choose how you're quizzed.",
  "reason.matchDesc": "Match is for signed-in learners. Creating an account is free and takes a moment.",
  "reason.unquizableTitle": "This deck can't be quizzed",
  "reason.unquizableDesc":
    "Its cards don't have a question and answer pair we can build questions from. You can still read them in flashcards, or sign up to bring your own deck.",

  // Three whole sentences rather than one with a glued-on adjective. The original built
  // `${count} ${sourceNoun}card${s} in this set` — putting the modifier BEFORE the noun, which is
  // an English word-order assumption. Vietnamese puts it after ("thẻ đã gắn sao"), so the pieces
  // cannot be assembled the same way in both languages.
  "setup.availableAll": {
    one: "{count} card in this set — enter how many questions you want.",
    other: "{count} cards in this set — enter how many questions you want.",
  },
  "setup.availableStarred": {
    one: "{count} starred card in this set — enter how many questions you want.",
    other: "{count} starred cards in this set — enter how many questions you want.",
  },
  "setup.availableWeak": {
    one: "{count} still-learning card in this set — enter how many questions you want.",
    other: "{count} still-learning cards in this set — enter how many questions you want.",
  },
  "setup.cardsInSet": { one: "{count} card in this set", other: "{count} cards in this set" },
  "setup.unlockHint": " · star cards or answer a few to unlock the focused sets",
  "setup.starred": "Starred",
  "setup.ready": "Ready",
  "setup.back": "Back",
  "setup.questionCount": { one: "{count} question", other: "{count} questions" },
  "setup.noQuizzable":
    "None of the note types in {filename} have enough quizzable content. Decks with only single-field or image-only note types aren't supported.",

  // ---- settings --------------------------------------------------------------------------
  "settings.language": "Language",
  "settings.languageHint": "Applies to the interface. Your decks are never translated.",
  "settings.heading": "Settings",
  "settings.lede": "Appearance, account security, and more.",

  // "Appearance" names the section, "Theme" the control inside it. Two different words on
  // purpose — several languages, Vietnamese included, have no single word covering both.
  "settings.appearance": "Appearance",
  "settings.appearanceDesc": "Choose how Quizanki looks on this device.",
  // One whole sentence per resolved theme rather than splicing "light"/"dark" into a template:
  // the adjective inflects and moves in other languages. Same reasoning as `setup.availableAll`.
  "settings.followingSystemLight": "Following your system theme — currently light.",
  "settings.followingSystemDark": "Following your system theme — currently dark.",
  "settings.theme": "Theme",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.themeSystem": "System",
  "settings.textSize": "Text size",
  "settings.textSizeHint": "Drag to make the text bigger across the whole app.",
  "settings.savedThisBrowser": "Saved to this browser only.",

  "settings.notifications": "Notifications",
  "settings.notificationsDesc":
    "What shows up in the bell. Announcements from us always come through.",
  "settings.notificationsLoadFailed": "Couldn't load your notification settings.",

  "settings.ai": "AI generation",
  "settings.aiDesc":
    "Turn notes or a PDF into a draft deck. Add your own API key for a bigger daily allowance and to keep your material on your own provider account.",
  "settings.aiLoadFailed": "Couldn't load your AI settings.",
  "settings.aiUnsupported":
    "This server isn't set up to store personal API keys, so AI generation uses the shared free allowance only.",
  "settings.aiKeyInUse": "Your own key is in use",
  "settings.aiReplaceKey": "Replace your API key",
  "settings.aiYourKey": "Your Gemini API key",
  "settings.aiKeyPlaceholder": "Paste your key",
  "settings.aiSaveKey": "Save key",
  "settings.aiKeyStored":
    "Stored encrypted. It never comes back to this page and is only used on the server to generate your cards.",

  "settings.password": "Password",
  "settings.passwordDesc": "Set a new password. You'll stay signed in on this device.",
  "settings.newPassword": "New password",
  "settings.confirmPassword": "Confirm new password",
  "settings.passwordPlaceholder": "At least {count} characters",
  "settings.confirmPlaceholder": "Re-enter the password",
  "settings.updating": "Updating…",
  "settings.updatePassword": "Update password",
  "settings.passwordUpdated": "Password updated.",
  "settings.passwordUpdateFailed": "Couldn't update your password.",

  "settings.account": "Account",
  "settings.accountDesc": "Sign out on this device, or delete your account and all its decks.",
  "settings.deleteAccount": "Delete account",
  "settings.deleteAccountDesc":
    "Permanently removes your account and every deck. Not available yet — coming soon.",

  // ---- notification kinds -----------------------------------------------------------------
  // The server sends a kind, never a sentence, so the wording is ours. A kind we have no copy
  // for still renders, humanised from the identifier — see `kindCopy`'s fallback.
  "notifKind.newFollower": "New followers",
  "notifKind.newFollowerDesc": "When somebody starts following you.",
  "notifKind.authorPublished": "New decks from authors you follow",
  "notifKind.authorPublishedDesc": "When someone you follow publishes a deck.",
  "notifKind.deckShared": "Decks shared with you",
  "notifKind.deckSharedDesc": "When somebody sends you a deck directly.",
  "notifKind.deckReviewed": "Feedback on your decks",
  "notifKind.deckReviewedDesc":
    "When someone leaves a note with their rating. Only you can read those.",

  // ---- AI errors --------------------------------------------------------------------------
  // Fallbacks only. ⚠ When the backend sends its own message it WINS and is English — the
  // server has no locale. See `aiErrorKey`.
  "aiError.quota": "You've used today's AI generations. Try again tomorrow.",
  "aiError.unavailable": "AI generation isn't available right now.",
  "aiError.tooLarge": "That file is too large.",
  "aiError.offline": "Couldn't reach the server. Check your connection and try again.",
  "aiError.generic": "Couldn't generate cards from that. Try different material.",

  // ---- password rules ---------------------------------------------------------------------
  "auth.passwordTooShort": "Password must be at least {count} characters.",
  "auth.passwordsDontMatch": "The two passwords don't match.",

  // ---- shared words -----------------------------------------------------------------------
  "common.loading": "Loading…",
  "common.reset": "Reset",
  "common.remove": "Remove",
  "common.soon": "Soon",
  "common.signOut": "Sign out",
  // ---- app shell (on every signed-in page) ------------------------------------------------
  "shell.accountMenu": "Account menu",
  "shell.accountFallback": "Account",
  "shell.profile": "Profile",
  "shell.settings": "Settings",
  "shell.notifications": "Notifications",
  "search.label": "Search your decks",
  "search.placeholder": "Search your decks…",
  "search.noMatch": "No decks match “{query}”.",
  "search.empty": "You don’t have any decks yet.",
  "shell.notificationsUnread": "Notifications, {count} unread",
} as const satisfies Catalogue;

export type MessageKey = keyof typeof en;
