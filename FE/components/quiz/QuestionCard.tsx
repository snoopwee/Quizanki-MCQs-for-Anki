import type { PromptSegment } from "@/lib/buildQuestions";

// Renders the bundled prompt as labelled lines (term, reading, example, …).
// A single-field prompt still gets its label, which keeps decks consistent.
export function QuestionCard({ prompt }: { prompt: PromptSegment[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <dl className="space-y-3 text-center">
        {prompt.map((seg, i) => (
          <div key={`${seg.label}-${i}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {seg.label}
            </dt>
            <dd className="mt-0.5 text-2xl font-medium break-words">{seg.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
