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
  // ---- /import (the on-ramp) ----------------------------------------------------------------
  "import.preparingTitle": "Preparing your deck…",
  "import.preparingHint": "Laying out the cards for review.",

  "import.tabFile": "Upload .apkg",
  "import.tabText": "Paste text",
  "import.tabAi": "Generate with AI",
  "import.tabScratch": "Create from scratch",

  "import.resumeTitle": "You have an unsaved deck",
  // One sentence rather than three glued fragments: the original built
  // `name · N card(s) · edited AGE` in JSX, which fixes English word order and English
  // comma conventions. The age arrives already translated — see `draftAge` in lib/draftStore.
  "import.resumeMeta": {
    one: "{name} · {count} card · edited {age}",
    other: "{name} · {count} cards · edited {age}",
  },
  "import.resume": "Resume",

  // ⚠ This is a DECK NAME, written to the database — not just UI chrome. Translating it is
  // deliberate: it is the learner's own content and they will usually rename it. Checked first
  // that nothing in the FE or BE compares against the literal as a sentinel.
  "import.untitledDeck": "Untitled deck",
  "import.importedSet": "Imported set",

  "import.scratchHeading": "Create a deck from scratch",
  "import.scratchLede":
    "Start with a few blank cards and fill in the term, definition, and any images or audio yourself — then save it like any other deck.",
  "import.scratchStart": "Start a blank deck",

  "import.pasteHeading": "Import from plain text",
  "import.pasteLede":
    "Paste cards Quizlet-style — one card per row, term and definition separated by your chosen delimiter. Each becomes a Basic (front/back) card.",
  "import.deckName": "Deck name",
  "import.betweenTermDef": "Between term & definition:",
  "import.betweenRows": "Between rows:",
  "import.delimTab": "Tab",
  "import.delimComma": "Comma",
  "import.delimNewline": "New line",
  "import.delimSemicolon": "Semicolon",
  "import.detected": { one: "{count} card detected", other: "{count} cards detected" },
  "import.reviewCount": { one: "Review {count} card", other: "Review {count} cards" },
  "import.reviewCards": "Review cards",

  // ---- how old an unsaved draft is ------------------------------------------------------------
  // Keys rather than sentences because `describeAge` is pure and has no translator. English needs
  // the singular/plural split; Vietnamese does not inflect the noun, so it uses a plain string.
  "age.justNow": "just now",
  "age.minutes": { one: "{count} minute ago", other: "{count} minutes ago" },
  "age.hours": { one: "{count} hour ago", other: "{count} hours ago" },
  "age.days": { one: "{count} day ago", other: "{count} days ago" },
  "common.discard": "Discard",
  // The shape to paste, shown IN the textarea. The \t and \n are the literal separators it
  // is demonstrating -- they must survive translation, so only the two words change.
  "import.pastePlaceholder": "term\tdefinition\nterm\tdefinition",
  "uploader.lede":
    "Upload an Anki deck export (.apkg). Cards, pictures, and audio pronunciations all come across.",
  // {limit} rather than a hardcoded 50: the old value said "50 MB" in prose while the code
  // interpolated MAX_MB, so the two could drift apart silently.
  "uploader.dropzoneHintLimit": "Anki deck export · up to {limit} MB",
  // The CLIENT-side check knows the actual file size, which is more useful than the server's
  // generic 413 message, so it keeps its own key rather than reusing `uploader.tooLarge`.
  "uploader.tooLargeFile": "That deck is {size} MB — the limit is {limit} MB.",
  "uploader.studyOneNow": "— study one straight away, no file needed.",
  // Split so each link sits at the END of its own sentence. The original was one sentence with
  // two links buried mid-clause, which cannot be reordered for another language without
  // shattering it into untranslatable fragments.
  "uploader.orGrabFrom": "Or grab an .apkg from",
  "uploader.andUploadAbove": "and upload it above.",
  // The summary line is assembled from clauses rather than one template: it has three optional
  // middles (skipped / occlusion-excluded / audio) and one template per combination would be
  // eight keys.
  "uploader.sumNotes": { one: "{count} note", other: "{count} notes" },
  "uploader.sumSkipped": "{count} skipped",
  "uploader.sumOccluded": "{count} image-occlusion excluded",
  "uploader.sumAcross": { one: "across {count} note type.", other: "across {count} note types." },
  "uploader.sumAudio": "{count} with audio.",
  "uploader.occlusionWarning": {
    one: "Image-occlusion cards aren't supported in multiple-choice quizzes — they have no text to ask about. {count} card excluded.",
    other: "Image-occlusion cards aren't supported in multiple-choice quizzes — they have no text to ask about. {count} cards excluded.",
  },
  "discover.pagerLabel": "Pagination",
  "discover.pageOf": {
    one: "Page {page} of {pages} · {total} deck",
    other: "Page {page} of {pages} · {total} decks",
  },
  // ---- review before saving -------------------------------------------------------------------
  "review.heading": "Review before saving",
  "review.swapAll": "Swap term and definition for all cards",
  "review.swapAllTitle": "Swap the term and definition of all cards",
  "review.saving": "Saving…",
  "review.saveDeck": "Save deck",
  // {action} is the Save button's own label, so the two can never disagree. The original wrapped
  // it in <span className="font-semibold">; interpolating loses the bold, which is the right
  // trade — keeping it would pin the button name to one position in every language.
  "review.notSavedYet":
    "This deck isn't saved yet — nothing lands in your account until you hit {action}. Your progress here is kept on this device, so you can come back to it.",
  "review.imageUploadFailed":
    "Couldn't upload one of the card images. Your work is safe — try again.",
  "review.saveFailed": "Couldn't save the deck. Your work is safe — try again.",
  "review.fieldsHeading": "Fields shown on card",
  "review.fieldsLede": "Put each field on the Term or Definition side (or Off), or add your own.",
  "review.searchCards": "Search cards…",
  "review.countFiltered": "{shown} of {total} cards",
  "review.noMatch": "No cards match “{query}”.",
  "review.showMore": "Show {count} more",
  "review.remainingLeft": "({count} left)",
  "review.showAllTitle": "Render every remaining card — may take a moment on a very large deck",
  "review.showAll": "Show all",
  "review.addCard": "Add a card",
  "review.visibilityHeading": "Who can see this deck",
  "review.public": "Public",
  "review.private": "Private",
  // "Discover" stays as the page's proper name inside the sentence rather than being spliced in,
  // so a translation can put it wherever its grammar wants.
  "review.publicNote":
    "Anyone can find this deck on Discover and save their own copy of it. Your progress stays private. Only publish decks you're free to share.",
  "review.privateNote":
    "Only you can see this deck. You can publish it later from the deck's ⋯ menu.",

  // ---- the two sides of a card (shared by the editor and the fields panel) ---------------------
  "card.term": "Term",
  "card.definition": "Definition",

  // ---- which fields show on a card ------------------------------------------------------------
  "fields.cardsFallback": "Cards",
  "fields.shown": "{count} shown",
  "fields.deleteField": "Delete field {name}",
  "fields.deleteThisField": "Delete this field",
  "fields.needOneField": "A card needs at least one field on this side",
  "fields.hasContent": "This field has content — untick it to hide it instead",
  // One whole sentence per side. The original lowercased the side name and glued it on, which
  // assumes English casing rules and English word order.
  "fields.addToTerm": "Add field to term",
  "fields.addToDefinition": "Add field to definition",
  "fields.namePlaceholder": "Field name (e.g. Example)",
  "fields.add": "Add",
  "fields.duplicate": "A field named “{name}” already exists.",
  "card.termVoice": "Term voice",
  "card.definitionVoice": "Definition voice",
  "card.cloze": "Cloze",
  "card.swapFaces": "Swap front/back",
  "card.delete": "Delete card",
  // ---- generate a deck with AI ----------------------------------------------------------------
  "aiGen.tabText": "Paste notes",
  "aiGen.tabPdf": "Upload a PDF",
  "aiGen.yourNotes": "Your notes",
  "aiGen.notesPlaceholder": "Paste a chapter, a vocabulary list, lecture notes…",
  "aiGen.needMore": "Paste at least a paragraph — there's no making cards from one line.",
  "aiGen.charCount": "{count} characters",
  "aiGen.choosePdf": "Choose a PDF",
  "aiGen.pdfChosen": "{size} MB — click to choose another",
  "aiGen.pdfHint": "Up to {limit} MB. It needs selectable text — a scan won't work.",
  "aiGen.deckName": "Deck name",
  "aiGen.optional": "(optional)",
  "aiGen.fromFileName": "Taken from the file name",
  "aiGen.fromFirstLine": "Taken from the first line",
  "aiGen.upTo": "Up to",
  "aiGen.maxCards": "Maximum cards",
  "aiGen.cardsOption": "{count} cards",
  "aiGen.generating": "Generating…",
  "aiGen.generate": "Generate cards",
  "aiGen.takesAMinute": "This can take up to a minute for long material — keep this tab open.",

  // the disclosure, shown BEFORE generating rather than buried in settings
  "aiGen.ownKeyNotice":
    "Your material is sent to the AI provider using your own API key, under your agreement with them.",
  "aiGen.freeTierNotice":
    "Your material is sent to our AI provider to make cards. We use a free tier, where the provider may use what is sent to improve their products, including review by people.",
  "aiGen.dontPasteConfidential": "Don't paste anything confidential.",
  "aiGen.addOwnKey": "Add your own API key",
  "aiGen.toUseOwnAccount": "to use your own account instead.",
  "aiGen.draftNotice":
    "Cards are a draft — you review and edit every one before the deck is saved.",

  "aiGen.ready": { one: "{count} card ready to review", other: "{count} cards ready to review" },
  "aiGen.startOver": "Start over",
  "aiGen.reviewCards": "Review cards",

  // how much of today's allowance is left. Two sentences, not one with a spliced adjective.
  "aiGen.remainingShared": {
    one: "{count} free generation left today",
    other: "{count} free generations left today",
  },
  "aiGen.remainingOwnKey": {
    one: "{count} generation left today on your key",
    other: "{count} generations left today on your key",
  },

  "aiGen.inputTruncated":
    "That material was long, so only the first part was used. Generate again from the rest to continue.",
  "aiGen.partialRun":
    "The AI stopped partway, so these are the cards it managed. You can generate the rest separately.",

  "aiGen.notAPdf": "That doesn't look like a PDF.",
  "aiGen.emptyFile": "That file is empty.",
  "aiGen.pdfTooLarge": "That PDF is larger than {limit} MB. Try a single chapter.",
  "media.addImage": "Add image",
  "media.removeImage": "Remove image",
  "media.chooseImage": "Please choose an image file.",
  "media.imageUploadFailed": "Couldn't upload that image. Try again.",
  "media.addAudio": "Add audio",
  "media.removeAudio": "Remove audio",
  "media.chooseAudio": "Please choose an audio file.",
  "media.audioUploadFailed": "Couldn't upload that audio. Try again.",
  "media.uploading": "Uploading…",
  // ---- Learn settings -------------------------------------------------------------------------
  "learn.settingsTitle": "Learn settings",
  "learn.perSession": "Cards per session",
  "learn.perSessionRetry":
    "Missed cards come back until you get them right, so a session ends once every card is learned.",
  "learn.perSessionOnce": "Each card is asked once, so a session ends after this many questions.",
  // Five separate sentences rather than one template with branches: each says a different thing,
  // and only whole sentences survive translation intact.
  "learn.noCardsMatch": "No cards match these settings.",
  "learn.onlyNMatch": {
    one: "Only {count} card matches, so you'll learn all of them.",
    other: "Only {count} cards match, so you'll learn all of them.",
  },
  "learn.belowMinimum":
    "A session learns at least {min} cards, so this one starts with {effective}.",
  "learn.cappedToPool": "Only {count} cards match, so this one learns all {count}.",
  "learn.poolAvailable": "{count} cards available.",

  "learn.questionTypes": "Question types",
  "learn.questionTypesDesc": "Each time a card comes up, it's asked in one of these.",
  "learn.answerWith": "Answer with",
  "learn.answerWithDefinitionDesc": "See the term, answer with its definition.",
  "learn.answerWithTermDesc":
    "See the definition, answer with the term. Cloze cards are always asked as written.",

  "learn.starredOnly": "Starred cards only",
  "learn.starredCount": { one: "{count} starred card.", other: "{count} starred cards." },
  "learn.starSomeFirst": "Star some cards to use this.",
  "learn.includeMastered": "Include mastered cards",
  "learn.includeMasteredDesc": "Turn off to skip cards you've already mastered.",
  "learn.shuffle": "Shuffle",
  "learn.shuffleDesc": "Turn off to go through cards in deck order.",
  "learn.retryMissed": "Bring back missed cards",
  "learn.retryMissedDesc":
    "Ask a missed card again later in the session until you get it right.",
  "learn.retypeWrong": "Re-type wrong written answers",
  "learn.retypeWrongDesc": "Type the correct answer before moving on.",
  "learn.smartGrading": "Smart grading",
  "learn.smartGradingDesc": "Forgive small typos in longer written answers.",
  "learn.readAloud": "Read questions aloud",
  "learn.readAloudDesc": "Speak each question when it appears.",
  "learn.readAloudUnsupported": "This browser can't read text aloud.",

  "learn.startLearning": "Start learning",
  "learn.restartSession": "Restart session",
  // ---- Flashcards options ---------------------------------------------------------------------
  "flash.optionsTitle": "Flashcards Options",
  "flash.questionFormat": "Question Format",
  "flash.answerWithTerm": "Answer with Term",
  "flash.answerWithTermHelp": "Show the definition side first; you recall the term.",
  "flash.answerWithDefinition": "Answer with Definition",
  "flash.answerWithDefinitionHelp": "Show the term side first; you recall the definition.",
  "flash.learningOptions": "Learning Options",
  "flash.cardSorting": "Cards sorting",
  "flash.cardSortingHelp": "Mark each card Know / Still-learning as you go.",
  "flash.starredOnly": "Study starred terms only",
  "flash.starredOnlyHelp": "Limit the deck to cards you've starred.",
  "flash.starredNone": "Star some cards first to use this.",
  "flash.shuffle": "Shuffle terms",
  "flash.shuffleHelp": "Randomise the card order each run.",
  "flash.playback": "Playback",
  "flash.autoplaySpeed": "Autoplay speed",
  "flash.autoplaySpeedHelp": "How long each side is held before autoplay flips / advances.",
  "flash.cardFields": "Card fields",
  "flash.cardFieldsHelp":
    "Your deck has extra fields from the import. Choose which also appear on each card's definition side — this also sets the quiz's default fields.",
  "flash.pronunciation": "Pronunciation",
  "flash.pronunciationHelp":
    "The voice used for Listen (text-to-speech). Auto-detect guesses from the text — override it if a language is read wrong (e.g. kanji read as Chinese).",
  "flash.termLanguage": "Term language",
  "flash.termLanguageHelp": "The front side of each card.",
  "flash.definitionLanguage": "Definition language",
  "flash.definitionLanguageHelp": "The back side of each card.",
  "flash.saveOptions": "Save options",
  "flash.restart": "Restart flashcards",

  // The seconds come from the preset itself, so the number cannot drift from the prose.
  "autoplay.fast": "Fast · {seconds}s",
  "autoplay.normal": "Normal · {seconds}s",
  "autoplay.slow": "Slow · {seconds}s",
  "autoplay.verySlow": "Very slow · {seconds}s",
  "common.dialog": "Dialog",
  "legal.lastUpdated": "Last updated {date}",
  // ---- /export (make a quiz deck for Anki) ----------------------------------------------------
  "export.heading": "Make a quiz deck for Anki",
  "export.lede":
    "Every card becomes a multiple-choice question, with the wrong answers drawn from the deck's own other cards. Anki shuffles the options on every review, and its scheduler does the rest — no add-on needed.",
  "export.sourceTablist": "Where the deck comes from",
  "export.fromDeck": "One of your decks",
  "export.fromUpload": "Upload an .apkg",
  "export.noDecks":
    "You don't have any decks yet. Import one first, or switch to the upload tab to convert an .apkg without saving it.",
  "export.deck": "Deck",
  "export.chooseDeck": "Choose a deck…",
  "export.chooseFile": "Choose an .apkg file",
  "export.nothingSaved":
    "Nothing is saved to your account — the file is converted and handed straight back.",
  "export.mediaNotCarried":
    "Pictures and audio in an uploaded deck are not carried over. Import the deck first if you want to keep them.",
  "export.convertAndDownload": "Convert and download",
  "export.download": "Download quiz deck",
  "export.building": "Building…",
  "export.checkFailed": "Could not check this deck. Try again.",
  "export.noneQuizzable": "None of this deck's cards can become questions.",
  "export.becomeQuestions": "{exported} of {total} cards become multiple-choice questions.",
  "export.converted": "Converted {exported} of {total} cards.",
  "export.couldNotConvert": "{count} could not become questions.",
  // ⚠ {reason} comes from the BACKEND and is English — see the comment at the call site.
  "export.skippedReason": "{count} skipped — {reason}",
  "export.failed":
    "That didn't work. The file may not be a valid Anki package, or the deck may be too large.",
  "export.checking": "Checking which cards can become questions…",
  // ---- Export deck modal ----------------------------------------------------------------------
  "exportModal.title": "Export deck",
  "exportModal.format": "Format",
  "exportModal.csv": "CSV / TSV",
  "exportModal.csvHint": "Spreadsheet or Anki re-import — one row per card.",
  "exportModal.apkg": "Anki .apkg",
  "exportModal.apkgHint": "A real Anki package that opens straight back in Anki.",
  "exportModal.mcq": "Anki multiple choice",
  "exportModal.mcqHint": "Every card becomes a quiz question you answer inside Anki.",
  "exportModal.text": "Plain text",
  "exportModal.textHint": "Quizlet-style — paste into Quizlet's import box.",
  "exportModal.checkFailedHere":
    "Could not check this deck. Try again, or download and see what you get.",
  "exportModal.mcqNote":
    "The wrong answers come from this deck's own other cards, and Anki shuffles them on every review. Pictures and audio travel with it.",
  "exportModal.separator": "Separator",
  "exportModal.comma": "Comma (.csv)",
  "exportModal.tab": "Tab (.tsv)",
  "exportModal.includeTags": "Include a Tags column",
  "exportModal.multipleNoteTypes":
    "This deck has multiple note types — each is exported as its own block, prefixed with a “# name” line.",
  "exportModal.betweenTermDef": "Between term and definition",
  "exportModal.betweenRows": "Between rows",
  "exportModal.custom": "Custom",
  "exportModal.customExample": "e.g. -",
  "exportModal.apkgNote":
    "Builds an Anki package on the server and downloads it. Card progress isn't included — just the notes and their fields.",
  "exportModal.preview": "Preview",
  "exportModal.apkgFailed": "Couldn't build the .apkg. Please try again.",
  "exportModal.copied": "Copied ✓",
  "exportModal.copy": "Copy to clipboard",
  "exportModal.downloadApkg": "Download .apkg",
  "exportModal.downloadPlain": "Download",
  "deckPage.sharedManage": "Shared — manage the link",
  "deckPage.deckOptions": "Deck options",
  "deckPage.mixedNoteTypes": "This deck mixes Anki note types (e.g. Basic and Cloze)",
  "deckPage.cardTypes": { one: "{count} card type", other: "{count} card types" },
  // â  `deckPage.quizMeDesc` already holds "Quiz me — Multiple choice" and is the LABEL here;
  // these are the one-line subtitles under each study mode.
  "deckPage.quizMeHint": "Quizanki's signature MCQ exam with smart distractors",
  "deckPage.practiceTestHint": "Answer the whole paper, then get a score",
  "deckPage.learn": "Learn",
  "deckPage.learnHint": "Missed cards come back until you get them right",
  "deckPage.matchHint": "Race to pair terms & meanings",

  // ---- deck stats ("Your progress") -----------------------------------------------------------
  "stats.yourProgress": "Your progress",
  "stats.loadFailed": "Couldn't load your stats right now.",
  "stats.cardsSeen": "Cards seen",
  "stats.accuracy": "Accuracy",
  "stats.stillLearning": "Still learning",
  "stats.mastered": "Mastered",
  "stats.accuracyOverTime": "Accuracy over time",
  "stats.historyFailed": "Couldn't load your history.",
  "stats.deckMastery": "Deck mastery",
  "stats.lastDays": "Last {count} days",
  // ---- Share deck modal -----------------------------------------------------------------------
  "share.title": "Share deck",
  "share.anyoneWithLink": "Anyone with the link",
  // {name} interpolated rather than kept bold: the deck name has to be able to sit anywhere in
  // the sentence, and a <span> pins it to one position.
  "share.explain":
    "They can view {name} and save their own copy of it. Your cards and your progress stay yours — a copy is a separate deck and never writes back here.",
  "share.isACopy":
    "This is a copy of {author}'s deck, so it's still credited to them. Edit a card to make it your own — then you can share it.",
  "share.someoneElse": "someone else",
  "share.link": "Share link",
  "share.copied": "Copied",
  "share.copy": "Copy",
  "share.linkOnlyWhileOn":
    "The link only works while sharing is on — switch it off and it stops opening.",
  "share.privateNow": "This deck is private. Turn sharing on to get a link you can send to anyone.",
  "share.updateFailed": "Couldn't update sharing. Please try again.",
  "share.editFirst": "Edit a card in this copy to make it your own before sharing it.",

  // ---- Add to folder modal --------------------------------------------------------------------
  "folderModal.title": "Add to folder",
  "folderModal.explain":
    "Group {name} however you like. Folders are yours alone — no one else sees them, and a deck can sit in several.",
  "folderModal.thisDeck": "this deck",
  "folderModal.loading": "Loading folders…",
  "folderModal.loadFailed": "Could not load your folders.",
  "folderModal.none": "You don't have any folders yet — make one below.",
  "folderModal.saving": "Saving",
  "folderModal.saveFailed": "That change didn't save. Try again.",
  "folderModal.newName": "New folder name",
  "folderModal.creating": "Creating",
  "folderModal.createAndAdd": "Create & add",
  "folderModal.createFailed": "Couldn't create that folder.",

  "common.done": "Done",

  // ---- rating a deck (RateDeckModal + the star picker) ----------------------------------------
  "rate.title": "Rate this deck",
  "rate.loadFailed": "Couldn't load this deck's rating.",
  "rate.pick": "Pick a rating",
  // One word per star, so a click has a meaning attached to it and not just a count.
  "rate.star1": "Poor",
  "rate.star2": "Not great",
  "rate.star3": "Okay",
  "rate.star4": "Good",
  "rate.star5": "Excellent",
  "rate.privateNote": "Optional, and private — only this deck's author can read it.",
  "rate.notePlaceholder": "What worked, what didn't, anything that would make it better…",
  "rate.saveFailed": "Couldn't save your rating. Try again.",
  "rate.removing": "Removing",
  "rate.remove": "Remove rating",
  "rate.saving": "Saving",
  "rate.update": "Update",
  "rate.post": "Post rating",
  // The picker's five buttons have no visible text, so this IS their name to a screen reader.
  "rating.starsAria": { one: "{count} star", other: "{count} stars" },

  // ---- reporting a deck ------------------------------------------------------------------------
  "report.received": "Report received",
  "report.deck": "Report deck",
  // Split around the deck's name because the name is emphasised in its own element. Both languages
  // put it in the same place, so two keys beat an unstylable one-liner.
  "report.thanksPrefix": "Thanks — an admin will review",
  "report.tellUsPrefix": "Tell us what's wrong with",
  "report.privateNotice": "Reports are private and reviewed by an admin.",
  "report.thisDeck": "this deck",
  "report.reason": "Reason",
  "report.details": "Details (optional)",
  "report.detailsPlaceholder": "Anything that helps us review it…",
  "report.sendFailed": "Couldn't send the report. Try again.",
  "report.submit": "Submit report",
  // Only the LABEL of each reason is translated. The reason itself is the stored value -- it goes
  // to the backend and drives the admin queue's filter -- so it stays this English wording.
  "reportReason.spam": "Spam",
  "reportReason.inappropriate": "Inappropriate",
  "reportReason.copyright": "Copyright",
  "reportReason.wrongMisleading": "Wrong or misleading",
  "reportReason.other": "Other",

  // ---- deck-page tree leftovers ----------------------------------------------------------------
  // KebabMenu's DEFAULT label. Every caller that passes one is fine; the default is what a caller
  // who passes nothing ships, and it was English.
  "common.options": "Options",
  "study.noFlashcards":
    "We couldn't build any flashcards from this deck — its note types don't have readable text fields.",
  "study.noCardsMatch": "No cards match {query}.",
  "study.thisFilter": "this filter",
  "setup.selectField": "Select a field",
  "setup.eg": "e.g. {sample}",
  "setup.emptySample": "(empty)",

  // ---- the quiz RUN (what only appears once you answer) ---------------------------------------
  "quiz.quiz": "Quiz",
  "quiz.question": "Question",
  "quiz.next": "Next",
  "quiz.finish": "Finish",
  // What a blank written answer is recorded AS, for the review list. Display only -- the backend
  // is told `correct`, never the text.
  "quiz.blank": "(blank)",
  "quiz.correctExclaim": "Correct!",
  "quiz.answerLabel": "Answer:",
  "quiz.proposedAnswer": "Proposed answer",
  // The DISPLAY of a true/false verdict. The recorded value stays the English "True"/"False" --
  // grading compares against it, so translating it in place would break the quiz in Vietnamese.
  "quiz.true": "True",
  "quiz.false": "False",
  // The footer prompt before a question is answered, one per format.
  "quiz.hintMcq": "Pick the closest answer",
  "quiz.hintTrueFalse": "True or false?",
  "quiz.hintWritten": "Type your answer",
  "quiz.typeAnswer": "Type the answer…",
  "quiz.yourAnswer": "Your answer",
  "quiz.checkAnswer": "Check answer",
  "quiz.correctAnswer": "Correct answer",
  "quiz.countedCorrect": "Counted as correct",
  "quiz.iWasRight": "I was right — count it",
  "quiz.loadingTest": "Loading test…",
  "quiz.apply": "Apply",
  "study.loadingDeck": "Loading deck…",

  // The score line keeps its bold fraction, so it is a prefix + the fraction + a suffix rather
  // than one sentence with a placeholder. Both languages put the number in the same place.
  "results.youGotPrefix": "You got",
  "results.ofTotal": "{score} of {total}",
  "results.youGotSuffix": "correct.",
  "results.youAnswered": "You answered",

  // ---- the practice test ----------------------------------------------------------------------
  "practice.leave": "Leave the test",
  "practice.title": "Practice test",
  "practice.answered": "{done} of {total} answered",
  "practice.questionOf": "Question {index} of {total}",
  "practice.jumpTo": "Jump to a question",
  // The navigator buttons show only a number, so this IS each one's name.
  "practice.navAnswered": "Question {index}, answered",
  "practice.navUnanswered": "Question {index}, not answered",
  "practice.blanks": {
    one: "{count} question is still blank — blanks are marked wrong.",
    other: "{count} questions are still blank — blanks are marked wrong.",
  },
  "practice.goToFirst": "Go to the first",
  "practice.submitAnyway": "Submit anyway",
  "practice.previous": "Previous",
  "practice.submit": "Submit test",
  "practice.setupTitle": "Set up a practice test",
  "practice.setupDesc":
    "Answer the whole paper, then submit it to be scored. No feedback until you do — you can move between questions and change your answers freely.",
  "practice.startTest": "Start test",
  "practice.newTest": "New test",

  // ---- a Learn session in progress ------------------------------------------------------------
  "learn.endSession": "End session",
  "learn.label": "Learn",
  "learn.resumed": "Learn · resumed",
  // The progress counter reads "7 / 20 learned" when missed cards come back, "done" when each
  // card is asked once. Two words, not one with an "-ed" appended.
  "learn.learnedWord": "learned",
  "learn.doneWord": "done",
  "learn.retypePrompt": "Type the correct answer to continue",
  "learn.retypePlaceholder": "Type the answer shown above…",
  "learn.startingSession": "Starting your session…",
  "learn.startFailedTitle": "Couldn't start a session",
  "learn.startFailedText": "Check your connection and try again.",
  "learn.tryAgain": "Try again",
  "learn.emptyTitle": "Nothing to learn with these settings",
  "learn.changeSettings": "Change settings",
  // Why a session came up empty, and what to change. One whole sentence per case rather than a
  // built-up one -- each names a different setting.
  "learn.emptyStarredMastered":
    "Every starred card is already mastered. Star more cards, or include mastered cards.",
  "learn.emptyNoStarred": "No starred cards here yet. Star a few, or turn off Starred cards only.",
  "learn.emptyAllMastered":
    "Every card here is already mastered. Turn on Include mastered cards to review them.",
  "learn.emptyNoQuizzable":
    "This deck has no cards Learn can ask. Each card needs a question and an answer.",
  "learn.choosePrompt": "Choose how you want to learn {deck}.",

  // ---- the end-of-session summary -------------------------------------------------------------
  "learn.sessionComplete": "Session complete",
  "learn.praiseFlawless": "Flawless!",
  "learn.praiseNice": "Nicely done!",
  "learn.praiseAllLearned": "Every card learned!",
  "learn.praiseKeepPracticing": "Keep practicing!",
  "learn.answerCount": { one: "{count} answer", other: "{count} answers" },
  // The count is bold in its own element, so these sentences are a prefix, the count, then the
  // rest. The counts inside the rest are already-formatted strings.
  "learn.youLearnedPrefix": "You learned",
  "learn.firstTryLine": "{right} right on the first try, {answers} in all.",
  "learn.youAnsweredPrefix": "You answered",
  "learn.rightMissedLine": "{right} right, {missed} missed.",
  "learn.whereStand": "Where these cards stand",
  "learn.masteryNote": "Mastery after this session. Every answer counts, just like in a quiz.",
  "learn.tookMoreTries": "Took more than one try",
  "learn.missedTimes": { one: "missed {count} time", other: "missed {count} times" },
  "learn.keepLearning": "Keep learning",

  // ---- Match ----------------------------------------------------------------------------------
  "match.loading": "Loading match…",
  "match.exit": "Exit match",
  "match.header": "Match · {deck}",
  "match.tagline": "Pair every term with its meaning",
  "match.notEnough":
    "Match needs at least two cards that have both a term and a definition. This deck doesn't have enough yet.",
  "match.pairsMatched": "{done} of {total} pairs matched",
  "match.allMatched": "All matched",
  "match.newBest": "🎉 New best time!",
  "match.best": "Best: {time}",
  "match.playAgain": "Play again",

  // ---- counts, as plural keys -----------------------------------------------------------------
  // `card.count` is shared: the deck header, the shared-deck header, deck search, the author page
  // and the Learn summary all count cards, and all of them used to build the plural by hand.
  "card.count": { one: "{count} card", other: "{count} cards" },
  "card.clozeCount": { one: "{count} cloze card", other: "{count} cloze cards" },
  "deck.count": { one: "{count} deck", other: "{count} decks" },
  "deck.publicCount": { one: "{count} public deck", other: "{count} public decks" },
  "follow.followerCount": { one: "{count} follower", other: "{count} followers" },
  "import.cardsDetected": { one: "{count} card detected", other: "{count} cards detected" },
  "deckPage.noteCount": { one: "{count} note", other: "{count} notes" },
  "deckPage.hideAnswers": "Hide answers",
  "deckPage.showAnswers": "Show answers",

  // ---- shared leaf buttons: these ARE their only name to a screen reader ------------------------
  "speak.read": "Read the text aloud (text-to-speech)",
  "speak.stop": "Stop",
  "speak.stopReading": "Stop reading",
  "speak.playAudio": "Play audio",
  "speak.stopAudio": "Stop audio",
  "speak.nothingToRead": "Nothing to read",
  "star.star": "Star this card",
  "star.unstar": "Unstar this card",
  "star.starTitle": "Star to focus on this card",
  "star.starredTitle": "Starred — click to remove",

  // The accuracy chart's empty state -- only renders with no history, which is why a census of
  // the panel that owns it missed it.
  "stats.noHistory": "No study history yet.",
  "stats.noHistoryHint": "Take a quiz or learn this deck and your accuracy will chart here.",

  // The keyboard hints under a question. The KEY NAMES stay as they are -- A, D, T, F and Enter
  // are the physical keys, the same on a Vietnamese keyboard, so only the sentence around them
  // moves (the same reason `import.delimTab` is still "Tab").
  "quiz.keysMcq": "A–D or 1–4 to answer",
  "quiz.keysTrueFalse": "T / F to answer",
  "quiz.keysContinue": "Enter to continue",
  "results.end": "End",

  // ---- the flashcard editor (/decks/[id]/edit) -------------------------------------------------
  "editor.loading": "Loading editor…",
  // A native window.confirm, so this one really is just a string.
  "editor.discardConfirm": "Discard your changes?",
  "editor.title": "Edit flashcards",
  "editor.swapAll": "Swap term and definition for all cards",
  "editor.swapAllTitle": "Swap the term and definition of all cards",
  "editor.importCards": "Import cards",
  "editor.otherTab": "This deck is open in another tab. Whichever tab you save last wins.",
  "editor.saveFailed": "Couldn't save the deck. Please try again.",
  "editor.deckName": "Deck name",
  "editor.fieldsHeading": "Fields shown on card",
  "editor.fieldsHelp": "Put each field on the Term or Definition side (or Off), or add your own.",
  "editor.searchCards": "Search cards…",
  "editor.countFiltered": "{shown} of {total} cards",
  "editor.dragToReorder": "Drag a card to reorder it.",
  "common.save": "Save",
  // The two field names the editor renames for the learner. Every OTHER field name comes from the
  // deck itself and stays exactly as the .apkg spells it -- see `fieldLabel`.
  "fields.term": "Term",
  "fields.definition": "Definition",

  // ---- the single-card edit modal --------------------------------------------------------------
  "editCard.title": "Edit flashcard",
  // Split around the <code> marker, which is literal syntax and must not be translated.
  "editCard.clozePrefix": "This is a cloze card. Keep the",
  "editCard.clozeSuffix": "markers intact — each one becomes a separate question.",
  "editCard.swap": "Swap front and back",
  "editCard.termVoice": "Term voice",
  "editCard.definitionVoice": "Definition voice",
  "editCard.saveFailed": "Couldn't save your changes. Please try again.",
  "editCard.voiceHelp":
    "“Voice” sets the text-to-speech language for that side. Leave on Auto-detect unless it's read in the wrong language (e.g. kanji read as Chinese).",
  "editCard.saveChanges": "Save changes",

  // ---- bringing cards INTO the editor ----------------------------------------------------------
  "importModal.howToAdd": "How to add them",
  "importModal.append": "Append to the end",
  "importModal.replace": "Replace the entire set",
  "importModal.replaceWarning":
    "Replacing removes every current card (and its study progress) when you Save.",
  "importModal.source": "Source",
  "importModal.pasteText": "Paste text",
  "importModal.uploadApkg": "Upload .apkg",
  "importModal.addCards": "Add cards",
  "importModal.replaceCards": "Replace cards",
  "importModal.apkgNote": "Cards from the file are added as Basic (front/back) cards.",

  // ---- folders ---------------------------------------------------------------------------------
  "folders.newFolder": "New folder",
  "folders.loadFailed": "Could not load folders.",
  "folders.noneYet": "No folders yet.",
  "folders.noneYetHelp":
    "Group decks however you like — by subject, by exam, by textbook. A deck can sit in several folders.",
  "folders.nameLabel": "Folder name",
  "folders.renameFailed": "Couldn't rename it.",
  "folders.deleteConfirm": "Delete “{name}”?",
  "folders.deleteNote": "The decks inside it stay in your library.",
  "folders.rename": "Rename",
  "folders.delete": "Delete",
  "folders.cardOptions": "{name} options",
  "folders.goneNote":
    "It may have been deleted. Your decks are unaffected — deleting a folder never touches what was inside it.",
  "folders.emptyHint": "Open a deck and use its ⋯ menu to file it here.",
  // Deliberately its own key rather than reusing `aiError.offline`: same sentence today, but one
  // belongs to the AI subsystem and one to anything else that cannot reach the server.
  "common.offline": "Couldn't reach the server. Check your connection and try again.",

  // ---- text-to-speech voice picker -------------------------------------------------------------
  // The language NAMES are not keyed: `languageLabel` asks Intl.DisplayNames for them in the
  // reader's locale, so a new row in TTS_LANGUAGE_OPTIONS needs no translation at all.
  "tts.autoDetect": "Auto-detect",
  "tts.autoDetectWith": "Auto-detect ({language})",

  // ---- carry-ins: plurals and names on screens already called done -----------------------------
  "stats.chartAria": {
    one: "Accuracy across {count} study session; most recent {pct} percent.",
    other: "Accuracy across {count} study sessions; most recent {pct} percent.",
  },
  "deckPage.copyCount": { one: "{count} copy", other: "{count} copies" },
  "streak.dayCount": { one: "{count} day", other: "{count} days" },
  "streak.title": "Study streak · {caption} · best {best}",
  "streak.aria": "Study streak: {value}. {caption}.",
  "folders.lede": "Group decks by subject, exam or textbook. A deck can sit in several folders at once.",

  // ---- compact timestamps (a notification row, a feedback note) --------------------------------
  // The LONG `age.*` forms above are the import draft's ("5 minutes ago"). These are the tight
  // ones that sit at the right edge of a row. Intl.RelativeTimeFormat cannot make them: its
  // narrow Vietnamese is still "5 phút trước", and numeric:"auto" turns 2 days into "the day
  // before yesterday".
  "age.minutesShort": "{count}m",
  "age.hoursShort": "{count}h",
  "age.daysShort": "{count}d",

  // ---- the author-only feedback page -----------------------------------------------------------
  "feedback.title": "Feedback",
  // Split around the deck's name, which is emphasised in its own element.
  "feedback.ledePrefix": "What people wrote when they rated",
  "feedback.ledeSuffix":
    "Only you can see these. Names aren't shown — one rating per person, so every note is someone different.",
  "feedback.loading": "Loading feedback…",
  "feedback.loadFailed": "Couldn't load this deck's feedback.",
  "feedback.noneYet": "No notes yet.",
  "feedback.noneYetHelp":
    "People can leave one when they rate your deck. Ratings without a note still count towards your score.",
  "feedback.deleteConfirm": "Delete this note?",
  "feedback.deleteRule":
    "Their {stars}-star rating stays and still counts towards your score — only the text goes.",
  "feedback.deleteNote": "Delete note",
  "feedback.reportToAdmin": "Report to admin",
  "feedback.footer":
    "Deleting a note removes the text for good, and their rating still counts. Report it instead if it's abusive: an admin can remove the whole rating, and either way they'll tell you what they decided.",

  // ---- reporting a note to an admin ------------------------------------------------------------
  "reportNote.sent": "Report sent",
  "reportNote.title": "Report this note",
  "reportNote.thanks": "Thanks — an admin will look at it. You'll get a notification when they have.",
  "reportNote.stillDelete":
    "You can still delete the note yourself in the meantime — the report keeps its own copy of the text, so it can still be judged.",
  "reportNote.lede":
    "For a note that's abusive rather than just unwelcome. Say why below — an admin reads it, and if they agree they'll remove the whole rating, stars included.",
  "reportNote.addAnything": "Anything to add",
  "reportNote.optional": "(optional)",
  "reportNote.detailsPlaceholder": "Context an admin would need…",
  "reportNote.sendFailed": "Couldn't send that report. Try again.",
  "reportNote.sending": "Sending",
  "reportNote.submit": "Report",
  // The NOTE vocabulary. Like the deck reasons, the stored value stays English -- only the label
  // moves. A note is reported for how it BEHAVES, a deck for what it IS.
  "reportReason.abusive": "Abusive",
  "reportReason.harassment": "Harassment",
  "reportReason.offTopic": "Off-topic",

  // ---- the notification panel ------------------------------------------------------------------
  "notif.marking": "Marking…",
  "notif.markAllRead": "Mark all read",
  "notif.clearAll": "Clear all",
  "notif.clearConfirm": "Delete all your notifications?",
  "notif.clearIrreversible": "This one can't be undone.",
  "notif.clearing": "Clearing",
  "notif.loadFailed": "Couldn't load your notifications.",
  "notif.noneYet": "Nothing yet.",
  "notif.noneYetHelp":
    "Decks shared with you, new decks from authors you follow, and news from us land here.",
  // The row's title comes from the BACKEND, which has no locale -- only our verb translates.
  "notif.deleteRow": "Delete: {title}",

  "common.deleting": "Deleting",
} as const satisfies Catalogue;

export type MessageKey = keyof typeof en;
