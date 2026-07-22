// The Quizanki brand mark: an accent "Q" tile + wordmark. Shared by the landing
// header and the app sidebar so the identity is identical everywhere. `size="lg"`
// grows the tile to match the sidebar's 40px action tiles (the "New deck" button).
export function BrandMark({
  withWordmark = true,
  size = "sm",
}: {
  withWordmark?: boolean;
  size?: "sm" | "lg";
}) {
  const tile = size === "lg" ? "h-10 w-10 rounded-xl text-lg" : "h-7 w-7 rounded-[9px] text-sm";
  return (
    <span className="flex items-center gap-2">
      <span
        className={`font-display grid place-items-center bg-linear-to-br from-accent to-accent-2 font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-glow)] ${tile}`}
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
