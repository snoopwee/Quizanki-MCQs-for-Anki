import { z } from "zod";

// Validates the payload sent to POST /api/v1/decks. Mirrors the BE
// ImportDeckRequest bean-validation constraints. A deck is the whole flashcard
// deck (note types + notes); the quiz field choice is made later, at test time.

export const noteRequestSchema = z.object({
  ankiNoteId: z.string().nullish(),
  fields: z.record(z.string()).refine((f) => Object.keys(f).length > 0, {
    message: "Note must have at least one field",
  }),
  tags: z.array(z.string()).default([]),
});

export const noteTypeRequestSchema = z.object({
  ankiModelId: z.number().nullish(),
  name: z.string().min(1).max(200),
  cloze: z.boolean(),
  fieldNames: z.array(z.string()).min(1, "Note type needs at least one field"),
  frontFields: z.array(z.string()),
  backFields: z.array(z.string()),
  notes: z.array(noteRequestSchema).min(1, "Note type needs at least one note"),
});

export const importDeckSchema = z.object({
  name: z.string().min(1, "Deck name is required").max(200),
  subdeckPath: z.string().max(500).nullish(),
  sourceFilename: z.string().max(300).nullish(),
  noteTypes: z.array(noteTypeRequestSchema).min(1, "Deck needs at least one note type"),
});

export type NoteRequestInput = z.infer<typeof noteRequestSchema>;
export type NoteTypeRequestInput = z.infer<typeof noteTypeRequestSchema>;
export type ImportDeckInput = z.infer<typeof importDeckSchema>;
