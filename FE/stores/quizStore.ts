import { create } from "zustand";
import type { Question } from "@/lib/buildQuestions";

export interface AnswerRecord {
  noteId: string;
  question: string;
  correct: string;
  selected: string;
  wasCorrect: boolean;
}

interface QuizState {
  questions: Question[];
  currentIndex: number;
  selectedAnswer: string | null;
  score: number;
  answers: AnswerRecord[];
  sessionId: string | null;

  startSession: (questions: Question[], sessionId: string) => void;
  selectAnswer: (answer: string) => void;
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

  selectAnswer: (answer) => {
    const { selectedAnswer, questions, currentIndex, answers, score } = get();
    if (selectedAnswer !== null) return; // locked once answered
    const question = questions[currentIndex];
    if (!question) return;
    const wasCorrect = answer === question.correct;
    set({
      selectedAnswer: answer,
      score: wasCorrect ? score + 1 : score,
      answers: [
        ...answers,
        {
          noteId: question.noteId,
          question: question.question,
          correct: question.correct,
          selected: answer,
          wasCorrect,
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
