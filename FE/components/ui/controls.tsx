// Small form controls + the "Soon" tag, shared by the exam setup / runner /
// deck / dashboard screens rebuilt from the design reference.

// A disabled-feature marker. Real layout, not-yet-real feature — see the
// project_reference_future_features memory / ROADMAP candidate #8.
export function SoonTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-wide text-faint ${className}`}
    >
      Soon
    </span>
  );
}

// Sunk segmented control; active segment fills with the accent.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 rounded-input border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[7px] px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// iOS-style switch.
export function Toggle({
  on,
  onChange,
  disabled = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? "bg-accent" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

// Range slider + a value chip, accent-tinted.
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  // How the value chip is rendered (e.g. `(v) => `${v}%``). Defaults to the raw number.
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--accent)]"
      />
      <div className="w-16 rounded-input border border-line bg-surface-2 py-2 text-center font-mono text-base font-bold text-ink">
        {format(value)}
      </div>
    </div>
  );
}
