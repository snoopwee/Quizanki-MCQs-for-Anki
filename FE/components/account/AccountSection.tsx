import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";

// A titled settings card, shared by the Profile and Settings pages. `tone="danger"`
// paints the destructive-actions block. Matches the warm design system (ivory
// surface, hairline header divider, accent-soft icon chip).
export function AccountSection({
  icon,
  title,
  description,
  tone = "default",
  children,
}: {
  icon: IconName;
  title: string;
  description?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <Card className={`overflow-hidden ${danger ? "border-danger/40" : ""}`}>
      <div className="border-b border-line p-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-input ${
              danger ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent-ink"
            }`}
          >
            <Icon name={icon} size={17} />
          </span>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            {title}
          </h2>
        </div>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

// Shared text-input look for the account forms.
export const accountInputClasses =
  "w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus-ring disabled:opacity-60";
