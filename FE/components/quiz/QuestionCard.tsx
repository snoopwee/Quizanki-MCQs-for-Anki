import type { PromptSegment } from "@/lib/buildQuestions";

// Renders the bundled prompt as labelled lines (term, reading, example, …),
// centered to fill its side of the quiz rectangle. The surrounding container
// supplies the border/background.
export function QuestionCard({ prompt }: { prompt: PromptSegment[] }) {
  return (
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
  );
}
