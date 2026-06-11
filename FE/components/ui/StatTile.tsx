import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { SoonTag } from "@/components/ui/controls";

// A labelled metric tile (dashboard stats, results breakdown). `color` tints the
// icon chip; `soon` flags a metric we don't compute yet.
export function StatTile({
  icon,
  label,
  value,
  sub,
  color = "var(--accent)",
  soon = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;
  soon?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-input"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
        >
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-muted">{label}</span>
        {soon && <SoonTag className="ml-auto shrink-0" />}
      </div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-xs text-faint">{sub}</div>}
    </Card>
  );
}
