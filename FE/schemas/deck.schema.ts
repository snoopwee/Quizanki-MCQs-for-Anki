import { z } from "zod";

// Validates the payload sent to POST /api/v1/decks. Mirrors the BE
// ImportDeckRequest bean-validation constraints; min 4 notes so the quiz can
// always build a 4-option question.

export const noteRequestSchema = z.object({
  ankiNoteId: z.string().nullish(),
  fields: z.record(z.string()).refine((f) => Object.keys(f).length > 0, {
    message: "Note must have at least one field",
  }),
  tags: z.array(z.string()).default([]),
});

export const importDeckSchema = z.object({
  name: z.string().min(1, "Deck name is required").max(200),
  subdeckPath: z.string().max(500).nullish(),
  questionField: z.string().min(1).max(100),
  answerField: z.string().min(1).max(100),
  detectionConfidence: z.number().min(0).max(1).nullish(),
  notes: z.array(noteRequestSchema).min(4, "Need at least 4 cards to build a quiz"),
});

export type NoteRequestInput = z.infer<typeof noteRequestSchema>;
export type ImportDeckInput = z.infer<typeof importDeckSchema>;
