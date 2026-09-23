"use client";

import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";

/**
 * The handle input, with a live verdict — shared by the sign-up form and the one-time prompt, so
 * both say the same thing about the same rules.
 *
 * The verdict is held while a check is in flight rather than showing the last answer, because a
 * stale green tick next to a taken name is worse than a spinner.
 *
 * A parent that needs to gate its submit button calls `useUsernameAvailability` with the same
 * value — React Query dedupes it to the one request this field already made.
 */
export function UsernameField({
  id = "username",
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  label = "Username",
  hint,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  hint?: string;
}) {
  const check = useUsernameAvailability(value, !disabled);
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  const available = !check.checking && check.data?.available === true;
  const reason = check.checking ? null : check.data?.reason ?? null;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={`focus-within:ring-accent/40 flex items-center rounded-input border bg-surface-2 pl-3 transition focus-within:ring-2 ${
          reason ? "border-danger/50" : "border-line-strong"
        }`}
      >
        <span className="shrink-0 select-none font-mono text-sm text-faint">/user/</span>
        <input
          id={id}
          type="text"
          value={value}
          maxLength={30}
          disabled={disabled}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(e) => onChange(e.target.value)}
          placeholder="your-handle"
          className="w-full bg-transparent px-0 py-2.5 font-mono text-sm text-ink outline-none placeholder:font-sans placeholder:text-faint disabled:opacity-60"
        />
        <span className="grid w-9 shrink-0 place-items-center">
          {check.checking && trimmed.length >= 3 ? (
            <Spinner className="h-4 w-4 text-faint" label="Checking" />
          ) : available ? (
            <Icon name="check" size={16} className="text-success" />
          ) : null}
        </span>
      </div>

      {reason ? (
        <p className="text-xs text-danger">{reason}</p>
      ) : tooShort ? (
        <p className="text-xs text-muted">At least 3 characters.</p>
      ) : (
        <p className="text-xs text-muted">
          {hint ?? "This is your public page — people find and share you by it."}
        </p>
      )}
    </div>
  );
}
