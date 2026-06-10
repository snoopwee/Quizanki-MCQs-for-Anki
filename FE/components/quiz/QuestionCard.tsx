"use client";

import type { PromptSegment } from "@/lib/buildQuestions";
import { SpeakButton } from "@/components/shared/SpeakButton";
import { useSpeechSupported } from "@/hooks/useSpeech";

// Renders the bundled prompt as labelled lines (term, reading, example, …),
// centered to fill its side of the quiz rectangle. The surrounding container
// supplies the border/background. When speech is available, a speaker button
// reads the prompt (the term being asked) aloud — language auto-detected. Its id
// is fixed since only one question shows at a time; QuizSession cancels playback
// when the question changes.
export function QuestionCard({ prompt }: { prompt: PromptSegment[] }) {
  const speechOn = useSpeechSupported();
  const text = prompt.map((seg) => seg.value).join(". ");

  return (
    <div className="relative flex h-full flex-col">
      {speechOn && (
        <div className="absolute right-0 top-0 z-10">
          <SpeakButton id="quiz-question" text={text} size="sm" />
        </div>
      )}
      <dl className="nice-scroll flex h-full flex-col justify-center space-y-3 overflow-y-auto text-center">
        {prompt.map((seg, i) => (
          <div key={`${seg.label}-${i}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {seg.label}
            </dt>
            <dd className="mt-0.5 text-3xl font-medium break-words">{seg.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
