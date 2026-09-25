"use client";

import { AccountSection } from "@/components/account/AccountSection";
import { Toggle } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import {
  useNotificationSettings,
  useSetNotificationMuted,
} from "@/hooks/useNotificationSettings";
import { kindCopy } from "@/lib/notificationKinds";

// Which notifications reach the bell. Stored server-side as a mute list, so a switch that is ON
// means "no row" — which is why somebody who has never been here gets everything.
export function NotificationSettingsSection() {
  const settings = useNotificationSettings();
  const setMuted = useSetNotificationMuted();
  const rows = settings.data ?? [];

  return (
    <AccountSection
      icon="bell"
      title="Notifications"
      description="What shows up in the bell. Announcements from us always come through."
    >
      {settings.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> Loading…
        </p>
      ) : settings.isError ? (
        <p className="text-sm text-danger">Couldn&apos;t load your notification settings.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((setting) => {
            const copy = kindCopy(setting.kind);
            return (
              <li
                key={setting.kind}
                className="flex items-center gap-3 rounded-input px-2 py-2.5 transition hover:bg-surface-2"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-input bg-accent-soft text-accent">
                  <Icon name={copy.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{copy.label}</span>
                  {copy.description && (
                    <span className="mt-0.5 block text-xs text-muted">{copy.description}</span>
                  )}
                </span>
                {/* The switch reads as "send me these", which is the way round people think about
                    it — the mute list is storage, not vocabulary. */}
                <Toggle
                  on={!setting.muted}
                  onChange={(on) => setMuted.mutate({ kind: setting.kind, muted: !on })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </AccountSection>
  );
}
