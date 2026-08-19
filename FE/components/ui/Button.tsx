import type { ButtonHTMLAttributes } from "react";

// Shared button vocabulary for the warm design system. `buttonClasses` is split
// out so the same look applies to next/link <Link> CTAs, not just <button>.
type Variant = "primary" | "ghost" | "soft" | "dark" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white border border-transparent shadow-btn hover:opacity-95",
  ghost: "bg-surface text-ink border border-line-strong hover:border-accent hover:text-accent",
  soft: "bg-accent-soft text-accent-ink border border-transparent hover:bg-accent/20",
  dark: "bg-ink text-canvas border border-transparent hover:opacity-90",
  danger: "bg-transparent text-danger border border-danger hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[0.8125rem]",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-[0.9375rem]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-input font-semibold transition focus-ring disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function Button({
  variant,
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses({ variant, size, className })} {...rest} />;
}
