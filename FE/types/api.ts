// TypeScript shapes mirroring the Spring Boot DTOs (com.ankiquiz.dto).
// Keep in sync with BE when contracts change.

export type QuizDirection = "FRONT_TO_BACK" | "BACK_TO_FRONT";

// GET /api/v1/me — who the signed-in user is + whether they're an admin. The
// client uses isAdmin to show/hide the admin area; the backend enforces it too.
export interface MeResponse {
  userId: string;
  email: string;
  isAdmin: boolean;
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
}

export interface NoteResponse {
  id: string;
  deckId: string;
  fields: Record<string, string>;
  tags: string[];
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

// GET /api/v1/decks/{id}/stats/history — one point per test (quiz session) the
// learner took, oldest first. Legacy pre-V8 answers with no session id collapse
// per day. Only tests that happened are returned (no zero-fill).
export interface DeckHistoryPoint {
  at: number; // epoch ms (UTC) of the test's last answer; render local
  answered: number;
  correct: number;
  accuracy: number; // 0–1
}

export interface NoteRequest {
  ankiNoteId?: string | null;
  fields: Record<string, string>;
  tags: string[];
}

export interface NoteTypeRequest {
  ankiModelId?: number | null;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
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

export interface RecordAnswerRequest {
  noteId: string;
  correct: boolean;
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
}

export interface DeckContentsNoteType {
  id: string;
  ankiModelId: number | null;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  noteCount: number;
  notes: DeckContentsNote[];
}

// PUT /api/v1/decks/{id}/contents — full desired state from the flashcard editor.
export interface UpdateDeckContentsNoteType {
  id: string;
  frontFields: string[];
  backFields: string[];
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
  authorName: string | null;
  // The author's profile picture (null → initials).
  authorAvatarUrl: string | null;
  sourceAuthorName: string | null;
  sharedAt: string | null;
}

// GET /api/v1/public/authors/{authorId} — an author's public decks + who they are.
export interface AuthorPageResponse {
  authorId: string;
  authorName: string | null;
  // The author's profile picture for the page header (null → initials).
  authorAvatarUrl: string | null;
  deckCount: number;
  decks: PublicDeckSummary[];
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
