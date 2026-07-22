import { create } from "zustand";
import type { Question, PromptSegment } from "@/lib/buildQuestions";

export interface AnswerRecord {
  noteId: string;
  question: string;
  // The bundled prompt segments, so the results screen can render the missed
  // card front/back exactly like the flashcard list.
  prompt: PromptSegment[];
  correct: string;
  selected: string;
  wasCorrect: boolean;
  // Post-answer mastery (0-100). Computed optimistically on the client using
  // the same +15/-20 curve the BE runs, so the results screen has a value to
  // show even if the server hasn't acked yet.
  newMastery: number;
}

interface QuizState {
  questions: Question[];
  currentIndex: number;
  selectedAnswer: string | null;
  score: number;
  answers: AnswerRecord[];
  sessionId: string | null;

  startSession: (questions: Question[], sessionId: string) => void;
  // The session grades each answer (correctness differs by question kind) and
  // passes the result in: `selected` is the learner's answer for display, and
  // `newMastery` is computed by the caller (it knows the card's current mastery).
  selectAnswer: (selected: string, wasCorrect: boolean, newMastery: number) => void;
  nextQuestion: () => void;
  reset: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  score: 0,
  answers: [],
  sessionId: null,

  startSession: (questions, sessionId) =>
    set({
      questions,
      sessionId,
      currentIndex: 0,
      selectedAnswer: null,
      score: 0,
      answers: [],
    }),

  selectAnswer: (selected, wasCorrect, newMastery) => {
    const { selectedAnswer, questions, currentIndex, answers, score } = get();
    if (selectedAnswer !== null) return; // locked once answered
    const question = questions[currentIndex];
    if (!question) return;
    set({
      selectedAnswer: selected,
      score: wasCorrect ? score + 1 : score,
      answers: [
        ...answers,
        {
          noteId: question.noteId,
          question: question.question,
          prompt: question.prompt,
          correct: question.correct,
          selected,
          wasCorrect,
          newMastery,
        },
      ],
    });
  },

  nextQuestion: () =>
    set((s) => ({ currentIndex: s.currentIndex + 1, selectedAnswer: null })),

  reset: () =>
    set({
      questions: [],
      currentIndex: 0,
      selectedAnswer: null,
      score: 0,
      answers: [],
      sessionId: null,
    }),
}));
