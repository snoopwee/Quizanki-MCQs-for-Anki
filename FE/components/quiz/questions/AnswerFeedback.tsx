"use client";

import { Icon } from "@/components/ui/icons";
import { RichText } from "@/components/shared/RichText";
import { textDirection } from "@/lib/displayText";
import { answerHintKey } from "@/lib/questionAnswer";
import type { Question } from "@/lib/buildQuestions";
import { useT } from "@/components/i18n/LocaleProvider";

// The left side of a question footer. Before answering: a hint at what the format expects.
// After: instant feedback — a check or cross chip with "Correct!" or the right answer.
export function AnswerFeedback({
  question,
  answered,
  isCorrect,
}: {
  question: Question;
  answered: boolean;
  isCorrect: boolean;
}) {
  const t = useT();

  if (!answered) {
    return (
      <span className="font-mono text-sm text-faint">{t(answerHintKey(question.kind))}</span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-input ${
          isCorrect ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
        }`}
      >
        <Icon name={isCorrect ? "check" : "x"} size={18} />
      </span>
      <span className="min-w-0 truncate font-medium text-ink">
        {isCorrect ? (
          t("quiz.correctExclaim")
        ) : (
          <>
            {t("quiz.answerLabel")}{" "}
            <span dir={textDirection(question.correct)} className="text-success">
              <RichText text={question.correct} />
            </span>
          </>
        )}
      </span>
    </div>
  );
}
