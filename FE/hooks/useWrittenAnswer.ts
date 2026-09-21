import { useEffect, useState } from "react";
import { gradeWritten } from "@/lib/questionTypes";
import type { WrittenResult } from "@/lib/questionAnswer";

// Local state for a written question: the typed text, and (once checked) the auto-grade plus
// whether the learner overrode it. Kept out of any store — nothing is recorded until the
// learner moves on, so an "I was right" override changes the single recorded result rather
// than double-counting. Everything resets when `resetKey` changes (the question index).
export function useWrittenAnswer(resetKey: unknown) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<WrittenResult | null>(null);

  useEffect(() => {
    setInput("");
    setResult(null);
  }, [resetKey]);

  // Grades the typed text against the card's answer and reveals it. Checking locks the
  // answer, so a second check is a no-op. `options` passes through to gradeWritten
  // (Learn's smart grading); the quiz calls it without.
  function check(correct: string, options?: { typoTolerant?: boolean }) {
    if (result !== null) return;
    setResult({ autoCorrect: gradeWritten(input, correct, options), override: false });
  }

  function toggleOverride() {
    setResult((r) => (r ? { ...r, override: !r.override } : r));
  }

  // Clears the answer right away, in the same update as moving on. The `resetKey` effect
  // runs only after the next question has rendered, so a written question following
  // another would first mount disabled with the old result — and lose its autofocus.
  function reset() {
    setInput("");
    setResult(null);
  }

  return { input, setInput, result, check, toggleOverride, reset };
}
