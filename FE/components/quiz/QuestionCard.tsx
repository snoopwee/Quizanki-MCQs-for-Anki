"use client";

import type { PromptSegment } from "@/lib/buildQuestions";
import { SpeakButton } from "@/components/shared/SpeakButton";
import { useSpeechSupported } from "@/hooks/useSpeech";

// The exam prompt, centered big (reference exam layout). A bundled prompt
// (term, reading, example, …) renders the lines stacked; when speech is
// available a speaker reads the prompt aloud, language auto-detected. Its id is
// fixed since only one question shows at a time; QuizSession cancels playback
// when the question changes.
export function QuestionCard({ prompt }: { prompt: PromptSegment[] }) {
  const speechOn = useSpeechSupported();
  const text = prompt.map((seg) => seg.value).join(". ");
  const multi = prompt.length > 1;

  return (
    <div className="relative w-full text-center">
      {speechOn && (
        <div className="absolute right-0 top-0">
          <SpeakButton id="quiz-question" text={text} size="sm" />
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">Question</p>
      <dl className="nice-scroll mt-5 max-h-[40vh] space-y-3 overflow-y-auto">
        {prompt.map((seg, i) => (
          <div key={`${seg.label}-${i}`}>
            {multi && (
              <dt className="font-mono text-[11px] font-medium uppercase tracking-wide text-faint">
                {seg.label}
              </dt>
            )}
            <dd className="font-display text-3xl font-semibold leading-tight break-words text-ink sm:text-4xl">
              {seg.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
