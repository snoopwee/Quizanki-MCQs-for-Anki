import type { HTMLAttributes } from "react";

// Warm ivory card surface. `hover` adds the lift + shadow used by clickable
// cards (deck tiles, quick actions).
export function Card({
  hover = false,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={`rounded-card border border-line bg-surface ${
        hover ? "transition duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card" : ""
      } ${className}`}
      {...rest}
    />
  );
}
