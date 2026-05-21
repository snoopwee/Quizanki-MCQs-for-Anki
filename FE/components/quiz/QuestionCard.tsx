export function QuestionCard({ question }: { question: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
      <p className="text-2xl font-medium break-words">{question}</p>
    </div>
  );
}
