// TypeScript shapes mirroring the Spring Boot DTOs (com.ankiquiz.dto).
// Keep in sync with BE when contracts change.

export type QuizDirection = "FRONT_TO_BACK" | "BACK_TO_FRONT";

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
  noteTypes: ApkgNoteType[];
}

// GET /api/v1/decks/{id}/contents — a saved deck's full flashcard structure.
export interface DeckContentsNote {
  id: string;
  ankiNoteId: string | null;
  fields: Record<string, string>;
  tags: string[];
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
  noteTypes: DeckContentsNoteType[];
}
