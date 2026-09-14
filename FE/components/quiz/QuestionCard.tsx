"use client";

import type { PromptSegment } from "@/lib/buildQuestions";
import { SpeakButton } from "@/components/shared/SpeakButton";
import { useSpeechSupported } from "@/hooks/useSpeech";
import { textDirection, stripLatex } from "@/lib/displayText";
import { stripFurigana } from "@/lib/furigana";
import { RichText } from "@/components/shared/RichText";

// The exam prompt, centered big (reference exam layout). A bundled prompt
// (term, reading, example, …) renders the lines stacked; when speech is
// available a speaker reads the prompt aloud, language auto-detected. Its id is
// fixed since only one question shows at a time; QuizSession cancels playback
// when the question changes.
// The key the question speaker speaks under. Learn's "read question aloud" uses it too,
// so the button shows the narration it started.
export const QUESTION_SPEECH_ID = "quiz-question";

// The prompt as one string for text-to-speech: segments read as sentences, with
// furigana and LaTeX markup stripped.
export function promptSpeechText(prompt: PromptSegment[]): string {
  return stripFurigana(stripLatex(prompt.map((seg) => seg.value).join(". ")));
}

export function QuestionCard({ prompt }: { prompt: PromptSegment[] }) {
  const speechOn = useSpeechSupported();
  const text = promptSpeechText(prompt);
  const multi = prompt.length > 1;

  return (
    <div className="relative w-full text-center">
      {speechOn && (
        <div className="absolute right-0 top-0">
          <SpeakButton id={QUESTION_SPEECH_ID} text={text} size="sm" />
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">Question</p>
      <dl className="nice-scroll mt-5 max-h-[40vh] space-y-3 overflow-y-auto">
        {prompt.map((seg, i) => (
          <div key={`${seg.label}-${i}`}>
            {multi && (
              <dt className="font-mono text-[0.6875rem] font-medium uppercase tracking-wide text-faint">
                {seg.label}
              </dt>
            )}
            <dd
              dir={textDirection(seg.value)}
              className="font-display text-3xl font-semibold leading-tight break-words text-ink sm:text-4xl"
            >
              <RichText text={seg.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
