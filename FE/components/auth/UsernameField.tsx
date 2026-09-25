"use client";

import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { isOwnHandle, useUsernameAvailability } from "@/hooks/useUsernameAvailability";

/**
 * The handle input, with a live verdict — shared by the sign-up form, the one-time prompt and the
 * profile page, so all three say the same thing about the same rules.
 *
 * A plain box: no `/user/` stuck to the front. The prefix made the field look like a URL builder
 * rather than a name you type, and the URL is already shown elsewhere on the page.
 *
 * `ownHandle` is what the viewer is already called. Without it the check reports their own name as
 * taken — see `useUsernameAvailability`.
 *
 * A parent that needs to gate its submit calls the same hook with the same value; React Query
 * dedupes it to the one request this field already made.
 */
export function UsernameField({
  id = "username",
  value,
  onChange,
  ownHandle,
  disabled = false,
  autoFocus = false,
  label = "Username",
  hint,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  /** The viewer's current handle, so keeping it doesn't read as a collision with themselves. */
  ownHandle?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Omit or pass "" where the surrounding card already names the field. */
  label?: string;
  hint?: string;
}) {
  const check = useUsernameAvailability(value, !disabled, ownHandle);
  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  // Keeping your own name needs no tick — there is nothing to confirm.
  const showTick = check.available && !isOwnHandle(value, ownHandle);

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div
        className={`focus-within:ring-accent/40 flex items-center rounded-input border bg-surface-2 px-3 transition focus-within:ring-2 ${
          check.reason ? "border-danger/50" : "border-line-strong"
        }`}
      >
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
          placeholder="username"
          className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint disabled:opacity-60"
        />
        <span className="grid w-6 shrink-0 place-items-center">
          {check.checking && trimmed.length >= 3 ? (
            <Spinner className="h-4 w-4 text-faint" label="Checking" />
          ) : showTick ? (
            <Icon name="check" size={16} className="text-success" />
          ) : null}
        </span>
      </div>

      {check.reason ? (
        <p className="text-xs text-danger">{check.reason}</p>
      ) : tooShort ? (
        <p className="text-xs text-muted">At least 3 characters.</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
