// TypeScript shapes mirroring the Spring Boot DTOs (com.ankiquiz.dto).
// Keep in sync with BE when contracts change.

export type QuizDirection = "FRONT_TO_BACK" | "BACK_TO_FRONT";

// GET /api/v1/me — who the signed-in user is + whether they're an admin. The
// client uses isAdmin to show/hide the admin area; the backend enforces it too.
export interface MeResponse {
  userId: string;
  email: string;
  isAdmin: boolean;
  // Your public handle — the /user/{username} half of your profile URL. Null only for a profile
  // written before V35 assigned one.
  username: string | null;
  // False when we GENERATED that handle and you've never seen it — the client then asks you to
  // confirm or change it once, pre-filled. True once you've typed one, confirmed one, or edited it.
  usernameChosen: boolean;
}

// GET /api/v1/admin/reports/counts — outstanding moderation work, for the sidebar badge.
export interface ReportCounts {
  deckReports: number;
  noteReports: number;
  total: number;
}

// GET /api/v1/admin/reports — one row of the deck-report moderation queue.
export interface AdminReport {
  id: string;
  deckId: string;
  deckName: string | null;
  authorName: string | null;
  reporterId: string;
  reason: string | null;
  details: string | null;
  status: string; // open | resolved | dismissed
  createdAt: string;
  // Why an admin acted (V38). Null while open, and on rows predating the requirement.
  resolutionNote: string | null;
}

// GET /api/v1/admin/users — a page of Supabase users (from the Admin API). No user
// table locally, so this is fetched live. `banned` = an active ban.
export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  banned: boolean;
}

export interface AdminUsersPage {
  users: AdminUser[];
  page: number; // 1-based (GoTrue)
  perPage: number;
  hasMore: boolean;
}

// GET /api/v1/public/config — live site settings every client applies on load.
// PUT /api/v1/admin/config updates them. Messages are null when unset.
export interface SiteConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  announcement: string | null;
}

// GET /api/v1/admin/stats — site-wide totals for the admin overview. `creators`
// (users with ≥1 deck) and `learners` (users who've studied) are the honest user
// numbers we can measure without the Supabase Admin API (no user table).
export interface AdminStatsResponse {
  decks: number;
  publicDecks: number;
  notes: number;
  creators: number;
  learners: number;
  answers: number;
  decksLast30Days: number;
  answersLast7Days: number;
}

export interface CardStatsResponse {
  timesSeen: number;
  timesCorrect: number;
  accuracy: number;
  streak: number;
  // 0-100. The signal that drives quiz card selection. Distinct from accuracy.
  mastery: number;
  // User-set focus flag. Lets the learner mark cards and run a starred-only quiz.
  starred: boolean;
  lastSeenAt: string | null;
}

export interface DeckResponse {
  id: string;
  name: string;
  subdeckPath: string | null;
  sourceFilename: string | null;
  cardCount: number | null;
  importedAt: string | null;
  // 0-100. Mean mastery across every note in the deck, with unseen notes
  // counted as 0 (so a fresh deck is 0%, not undefined).
  completion: number;
  // Deck-level primary TTS language per face (BCP-47 primary subtag), or null to
  // auto-detect. term = front, definition = back.
  frontLang: string | null;
  backLang: string | null;
  // True while the deck's share link is live: anyone holding /shared/{id} can
  // preview it and clone it into their own account.
  isPublic: boolean;
  // Who is CREDITED for the deck — not necessarily who owns it. A copy is owned
  // by whoever took it but keeps crediting the original author until they edit
  // it. `sourceAuthorName` drives the "Original deck by X" line (null if this
  // deck isn't a copy).
  authorId: string;
  authorName: string | null;
  // The author's profile picture (denormalised, kept current on rename), shown on
  // Home / deck cards next to the name. Null → the client renders initials.
  authorAvatarUrl: string | null;
  sourceAuthorName: string | null;
  // The public rating (V28). count 0 means nobody has rated it yet, and the average is then 0 —
  // the UI says "Not rated yet" rather than showing zero stars. The notes people write with a
  // rating are private to the deck's author and never appear here.
  ratingCount: number;
  ratingAverage: number;
}

export interface NoteResponse {
  id: string;
  deckId: string;
  fields: Record<string, string>;
  tags: string[];
  // Per-face card image URLs (null = no image on that side).
  frontImageUrl: string | null;
  backImageUrl: string | null;
  // Per-face card audio URLs (null = no audio on that side).
  frontAudioUrl: string | null;
  backAudioUrl: string | null;
  cardStats: CardStatsResponse | null;
}

export interface DeckStatsResponse {
  totalCards: number;
  seenCards: number;
  averageAccuracy: number;
  weakCards: number;
  masteredCards: number;
  averageMastery: number;
}

// GET /api/v1/decks/{id}/stats/history — one point per study session (a quiz or a
// Learn session) the learner took, oldest first. Legacy pre-V8 answers with no
// session id collapse per day. Only sessions that happened are returned (no zero-fill).
export interface DeckHistoryPoint {
  at: number; // epoch ms (UTC) of the session's last answer; render local
  answered: number;
  correct: number;
  accuracy: number; // 0–1
  // Which surface the session was. Optional: a backend from before Phase 7 doesn't send it.
  source?: AnswerSource;
}

// ── Folders (Phase 10) ────────────────────────────────────────────────────────
// A folder is the VIEWER's own grouping: it can hold a deck they merely saved, and filing one
// changes nothing for its owner. A deck may sit in several folders.
export interface FolderResponse {
  id: string;
  name: string;
  deckCount: number;
  updatedAt: string;
  // Only meaningful when the list was fetched for one deck (the deck page's picker).
  containsDeck: boolean;
}

export interface FolderDetailResponse {
  id: string;
  name: string;
  decks: DeckResponse[];
}

// ── Deck ratings (V28) ───────────────────────────────────────────
// One deck's score, plus the caller's OWN rating. `myNote` is their own note echoed back so they
// can edit it — never anyone else's. Only the deck's author can read other people's notes.
export interface DeckRatingResponse {
  count: number;
  average: number;
  myStars: number | null;
  myNote: string | null;
  // How many notes are waiting on the feedback page. Only ever non-zero for the deck's author —
  // nobody else may read them, so nobody else is told how many there are.
  notesForAuthor: number;
}

/**
 * The author's feedback page. Notes carry NO name and no user id: candid feedback needs cover, and
 * one rating per person per deck already makes each note a different voice. `id` is an opaque
 * handle — the only thing needed to clear a note.
 */
export interface DeckFeedbackResponse {
  count: number;
  average: number;
  notes: {
    id: string;
    stars: number;
    note: string;
    writtenAt: string;
  }[];
}

/**
 * GET /api/v1/admin/review-reports — a note an author escalated.
 *
 * `noteSnapshot` is the text as it was when reported, so it survives being taken down;
 * `ratingStillThere` says whether there is still a rating to act on (the author may have cleared
 * the note while the star stands). There is no writer identity in this row on purpose: the queue
 * judges text, and acting on a person goes through the user tools.
 */
export interface AdminReviewReport {
  id: string;
  deckId: string;
  deckName: string | null;
  reporterId: string;
  reason: string | null;
  details: string | null;
  noteSnapshot: string;
  // ADMIN-ONLY: who wrote it, as recorded when it was reported. `writerName` may be null (Supabase
  // unreachable, or no name set); the id is what identifies the account. The author's feedback
  // page shows neither — it has nowhere to put them.
  writerId: string | null;
  writerName: string | null;
  ratingStillThere: boolean;
  status: string; // open | resolved | dismissed
  createdAt: string;
  // Why an admin acted (V38). Null while open, and on rows predating the requirement.
  resolutionNote: string | null;
}

// ── Notification settings (V34) ─────────────────────────────────
// Only kinds a person may switch off are listed — announcements are operational and the outcome of
// a report you filed is something you asked for, so neither is offered. Stored as a mute list, so
// "not listed as muted" means on.
export interface NotificationSettingResponse {
  kind: string;
  muted: boolean;
}

// ── Follows (Phase 11) ─────────────────────────────────────────
// Following is one-sided: a subscription to an author page. The author is never asked and is never
// told who followed them.
export interface FollowStatusResponse {
  following: boolean;
  followers: number;
  // True when you ARE the author, so the client shows no button rather than one that gets refused.
  self: boolean;
}

/**
 * One of your followers. Only ever served to you — public counts, private lists. `displayName` can
 * be null, and the row stays anyway: a follower who is hard to name is still a follower.
 */
export interface FollowerResponse {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FollowedAuthorResponse {
  authorId: string;
  username: string | null;
  // Null for an author whose public decks have all gone — the follow outlives them.
  authorName: string | null;
  authorAvatarUrl: string | null;
  publicDecks: number;
}

// ── Notifications (Phase 10) ─────────────────────────────────────────────────
// Rows are snapshots the backend wrote: `title` / `body` are its wording, while `kind`,
// `actorName` and `deckId` come along so the UI can word a row differently without a migration.
export type NotificationKind = "deck_shared" | "author_published" | "announcement";

export interface NotificationResponse {
  id: string;
  // Widened to string: an older client must render a row whose kind it has never heard of.
  kind: NotificationKind | string;
  title: string;
  body: string | null;
  /** An in-app route ("/decks/<id>"), never absolute — and checked again by `inAppHref`. */
  link: string | null;
  actorId: string | null;
  actorName: string | null;
  deckId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPageResponse {
  items: NotificationResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** ALL of this user's unread notifications, not just the ones on this page — the badge number. */
  unread: number;
}

export interface UnreadCountResponse {
  unread: number;
}

/** POST /api/v1/admin/announcements — what the broadcast actually did. */
export interface AnnouncementResultResponse {
  // "all" or "me"; echoed back so the UI reports what was really sent, not what was typed.
  audience: string;
  recipients: number;
  sent: number;
}

/** GET /api/v1/admin/announcements/audience — how many a broadcast would reach. */
export interface AudienceResponse {
  recipients: number;
}

// ── AI deck generation (Phase 9) ──────────────────────────────────────────────
// Whose key paid for a generation: our shared free-tier pool, or the user's own.
export type AiKeyOwner = "shared" | "user";

export interface AiDeckDraftMeta {
  provider: string;
  model: string;
  keyOwner: AiKeyOwner;
  // Generations left today after this one.
  remainingToday: number;
  cards: number;
  // How many provider calls it took — long material is split.
  chunks: number;
  // The material was longer than the server was willing to send.
  inputTruncated: boolean;
  // A later chunk failed; these are the cards that did come back.
  partial: boolean;
}

/** The draft arrives in the .apkg parser's shape, so `fromParsed` opens it in the review editor. */
export interface AiDeckDraftResponse {
  draft: ApkgParseResponse;
  meta: AiDeckDraftMeta;
}

/** Never carries the key itself — `hint` is its last four characters. */
export interface AiKeyStatusResponse {
  // False when the server has no encryption key, so nobody can store one.
  supported: boolean;
  configured: boolean;
  provider: string | null;
  hint: string | null;
}

export interface NoteRequest {
  ankiNoteId?: string | null;
  fields: Record<string, string>;
  tags: string[];
  // Per-face card image URL (null = none). Carried through import so a deck
  // imported with images keeps them on the cards.
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  // Per-face card audio URL (null = none). Carried through import/clone so a
  // duplicated deck keeps its pronunciations.
  frontAudioUrl?: string | null;
  backAudioUrl?: string | null;
}

export interface NoteTypeRequest {
  ankiModelId?: number | null;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  // Fields any card template renders (what Anki shows); omitted/[] = show every field.
  templateFields?: string[];
  notes: NoteRequest[];
}

// The whole flashcard deck: note types + their notes. Field choice is made at
// test time, so it's no longer part of the deck (see the 2026-05-26 direction
// change). Mirrors the BE ImportDeckRequest.
export interface ImportDeckRequest {
  name: string;
  subdeckPath?: string | null;
  sourceFilename?: string | null;
  // Deck-level primary TTS language per face, computed at save from the majority
  // language of each face. Null / omitted = auto-detect.
  frontLang?: string | null;
  backLang?: string | null;
  // Publish the deck to Discover on save. Chosen in the import review step
  // (which defaults to public); omitting it saves the deck private.
  isPublic?: boolean;
  noteTypes: NoteTypeRequest[];
}

export interface StartSessionRequest {
  deckId: string;
  questionCount?: number | null;
  direction?: QuizDirection | null;
}

export interface StartSessionResponse {
  sessionId: string;
}

// Which study surface produced an answer — mirrors answer_events.source (V21). Only the
// quiz and study mode record; deck-page flashcards are preview only and never do.
export type AnswerSource = "quiz" | "learn";

export interface RecordAnswerRequest {
  noteId: string;
  correct: boolean;
  // Omitted = a quiz answer (the backend's default).
  source?: AnswerSource;
  // The browser's IANA timezone, so the streak files today under the user's own date.
  timezone?: string;
}

// ── Daily study streak (Phase 7) ──────────────────────────────────────────────
// A day counts once a quiz or Learn answer is recorded; deck-page flashcards never mark one.

export interface StreakDay {
  // "YYYY-MM-DD", the user's LOCAL calendar date. Read it with parseLocalDate
  // (lib/streakDisplay) — never new Date(), which parses it as midnight UTC.
  date: string;
  studied: boolean;
}

export interface StreakResponse {
  current: number;
  longest: number;
  studiedToday: boolean;
  // Today and the six days before it, oldest first.
  last7Days: StreakDay[];
}

export interface RecordAnswerResponse {
  accuracy: number;
  streak: number;
  // The note's updated mastery after this answer, so the client can re-weight
  // selection without refetching the whole notes list.
  mastery: number;
}

// .apkg parse endpoint (POST /api/v1/public/parse-apkg) — public, stateless.
export interface ApkgParsedNote {
  // The persisted note UUID. Undefined for a fresh parse (not yet saved); set
  // when a saved deck's contents are adapted into this shape, so the quiz can
  // record answers against the real note id.
  id?: string;
  ankiNoteId: string | null;
  fields: Record<string, string>;
  tags: string[];
  // Per-card TTS language override per face (BCP-47 primary subtag), or null to
  // fall back to the deck default. Only present for saved decks.
  frontLang?: string | null;
  backLang?: string | null;
  // Per-face card image URL, or null when the side has no image.
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  // Per-face card audio URL, or null when the side has no audio.
  frontAudioUrl?: string | null;
  backAudioUrl?: string | null;
  // Per-face [sound:] media filename from the .apkg (not the bytes). The client
  // keeps these keyed by ankiNoteId and re-sends the .apkg after save so the
  // backend can stream just these clips to storage. Null when the side has none.
  frontAudioRef?: string | null;
  backAudioRef?: string | null;
}

export interface ApkgNoteType {
  id: number;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  // Fields the deck author placed on the card's question/answer side, from the
  // note type's first card template. Empty when no template is available (e.g.
  // modern decks); the client then falls back to its detection heuristic.
  frontFields: string[];
  backFields: string[];
  // Fields any card template renders (what Anki shows); omitted/[] when no template
  // info. Fields not in this set are metadata the editor hides by default.
  templateFields?: string[];
  noteCount: number;
  notes: ApkgParsedNote[];
}

export interface ApkgParseResponse {
  filename: string;
  collectionFile: string;
  schema: string;
  totalNotes: number;
  skippedNotes: number;
  // Notes excluded because every field was empty after cleaning — image-occlusion
  // and other media-only cards that can't be quizzed as multiple choice.
  imageOnlyNotes: number;
  // How many notes carry a [sound:] clip on either face. 0 = skip the post-save
  // audio import step entirely. Undefined when adapting a saved deck (no .apkg).
  audioNotes?: number;
  // Deck-level primary TTS language per face. Undefined for a fresh .apkg parse
  // (no deck yet); populated when a saved deck's contents are adapted into this
  // shape. term = front, definition = back.
  frontLang?: string | null;
  backLang?: string | null;
  noteTypes: ApkgNoteType[];
}

// GET /api/v1/decks/{id}/contents — a saved deck's full flashcard structure.
export interface DeckContentsNote {
  id: string;
  ankiNoteId: string | null;
  fields: Record<string, string>;
  tags: string[];
  // Per-card TTS language override per face, or null to inherit the deck default.
  frontLang: string | null;
  backLang: string | null;
  // Per-face card image URL, or null when the side has no image.
  frontImageUrl: string | null;
  backImageUrl: string | null;
  // Per-face card audio URL, or null when the side has no audio.
  frontAudioUrl: string | null;
  backAudioUrl: string | null;
}

export interface DeckContentsNoteType {
  id: string;
  ankiModelId: number | null;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  // Fields any card template renders (what Anki shows); omitted/[] for
  // pre-V19/template-less decks. Fields not in it are metadata hidden by default.
  templateFields?: string[];
  noteCount: number;
  notes: DeckContentsNote[];
}

// PUT /api/v1/decks/{id}/contents — full desired state from the flashcard editor.
export interface UpdateDeckContentsNoteType {
  id: string;
  frontFields: string[];
  backFields: string[];
  // The note type's full field list, so a field added/removed in the editor
  // persists on the type. Null/omitted → leave the stored field list unchanged.
  fieldNames?: string[] | null;
}

export interface UpdateDeckContentsNote {
  // null id = new card; null noteTypeId routes to the deck's Basic (Front/Back) type.
  id: string | null;
  noteTypeId: string | null;
  fields: Record<string, string>;
  tags: string[];
  // Per-face TTS language override (BCP-47 primary subtag); "" / null = inherit
  // the deck default. Travels with the card through the bulk editor save.
  frontLang?: string | null;
  backLang?: string | null;
  // Per-face card image URL; "" / null = no image. Travels with the bulk save.
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  // Per-face card audio URL; "" / null = no audio. Travels with the bulk save.
  frontAudioUrl?: string | null;
  backAudioUrl?: string | null;
}

export interface UpdateDeckContentsRequest {
  name: string;
  noteTypes: UpdateDeckContentsNoteType[];
  notes: UpdateDeckContentsNote[];
}

export interface DeckContentsResponse {
  id: string;
  name: string;
  subdeckPath: string | null;
  sourceFilename: string | null;
  cardCount: number | null;
  importedAt: string | null;
  completion: number;
  // Deck-level primary TTS language per face, or null to auto-detect.
  frontLang: string | null;
  backLang: string | null;
  // True while the deck's share link is live. Always true on the public read
  // (GET /public/shared/{id}), which is gated on it.
  isPublic: boolean;
  // Credit. Compare `authorId` against the signed-in user to tell whether they
  // may share this deck (only the credited author can).
  authorId: string;
  authorName: string | null;
  // The author's profile picture (denormalised, kept current on rename), shown
  // next to their name. Null → the client renders initials.
  authorAvatarUrl: string | null;
  sourceAuthorName: string | null;
  // The viewer's relationship to the deck: `owned` picks the deck-options kebab
  // (owned = edit/share/export/delete; otherwise Save to Home + Duplicate);
  // `saved` is the Save-to-Home toggle state. Both false on the public read.
  owned: boolean;
  saved: boolean;
  noteTypes: DeckContentsNoteType[];
}

// One row of the public deck directory.
export interface PublicDeckSummary {
  id: string;
  name: string;
  cardCount: number | null;
  // The credited author's id — lets the author name link to their author page.
  authorId: string;
  // Their public handle, so the row links straight to /user/{username} rather than bouncing
  // through the id alias. Null falls back to that alias.
  authorUsername: string | null;
  authorName: string | null;
  // The author's profile picture (null → initials).
  authorAvatarUrl: string | null;
  sourceAuthorName: string | null;
  sharedAt: string | null;  // The public rating, so a browser can judge a deck before opening it.
  ratingCount: number;
  ratingAverage: number;
}

// GET /api/v1/public/users/{username} (and the /public/authors/{authorId} alias) — somebody's
// public profile page: who they are, plus the decks they've published.
export interface AuthorPageResponse {
  authorId: string;
  // The handle in the page's real URL, /user/{username}. Null only for a profile written before
  // one was assigned; the client falls back to the /authors/{authorId} form.
  username: string | null;
  authorName: string | null;
  // The author's profile picture for the page header (null → initials).
  authorAvatarUrl: string | null;
  deckCount: number;
  decks: PublicDeckSummary[];  // How many people follow them. Public — it sits under the name for guests too; whether YOU
  // follow them is personal and comes from /authors/{id}/follow.
  followers: number;
}

// GET /api/v1/public/discover — one page of the directory plus the counts the
// pager needs (page is zero-based, matching the offset the client sends).
export interface PublicDeckPage {
  items: PublicDeckSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
