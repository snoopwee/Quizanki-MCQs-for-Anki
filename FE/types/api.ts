// TypeScript shapes mirroring the Spring Boot DTOs (com.ankiquiz.dto).
// Keep in sync with BE when contracts change.

export type QuizDirection = "FRONT_TO_BACK" | "BACK_TO_FRONT";

export interface CardStatsResponse {
  timesSeen: number;
  timesCorrect: number;
  accuracy: number;
  streak: number;
  lastSeenAt: string | null;
}

export interface DeckResponse {
  id: string;
  name: string;
  subdeckPath: string | null;
  questionField: string;
  answerField: string;
  detectionConfidence: number | null;
  cardCount: number | null;
  importedAt: string | null;
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
}

export interface NoteRequest {
  ankiNoteId?: string | null;
  fields: Record<string, string>;
  tags: string[];
}

export interface ImportDeckRequest {
  name: string;
  subdeckPath?: string | null;
  questionField: string;
  answerField: string;
  detectionConfidence?: number | null;
  notes: NoteRequest[];
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
}

// .apkg parse endpoint (POST /api/v1/public/parse-apkg) — public, stateless.
export interface ApkgParsedNote {
  ankiNoteId: string | null;
  fields: Record<string, string>;
  tags: string[];
}

export interface ApkgNoteType {
  id: number;
  name: string;
  cloze: boolean;
  fieldNames: string[];
  noteCount: number;
  notes: ApkgParsedNote[];
}

export interface ApkgParseResponse {
  filename: string;
  collectionFile: string;
  schema: string;
  totalNotes: number;
  skippedNotes: number;
  noteTypes: ApkgNoteType[];
}
