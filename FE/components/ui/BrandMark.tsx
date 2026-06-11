// The Quizanki brand mark: an accent "Q" tile + wordmark. Shared by the landing
// header and the app sidebar so the identity is identical everywhere.
export function BrandMark({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="font-display grid h-7 w-7 place-items-center rounded-[9px] bg-linear-to-br from-accent to-accent-2 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-glow)]"
        aria-hidden
      >
        Q
      </span>
      {withWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Quizanki<span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}
