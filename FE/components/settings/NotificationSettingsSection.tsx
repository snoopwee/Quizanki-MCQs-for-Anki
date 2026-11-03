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
import { useT } from "@/components/i18n/LocaleProvider";

// Which notifications reach the bell. Stored server-side as a mute list, so a switch that is ON
// means "no row" — which is why somebody who has never been here gets everything.
export function NotificationSettingsSection() {
  const t = useT();
  const settings = useNotificationSettings();
  const setMuted = useSetNotificationMuted();
  const rows = settings.data ?? [];

  return (
    <AccountSection
      icon="bell"
      title={t("settings.notifications")}
      description={t("settings.notificationsDesc")}
    >
      {settings.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> {t("common.loading")}
        </p>
      ) : settings.isError ? (
        <p className="text-sm text-danger">{t("settings.notificationsLoadFailed")}</p>
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
                  <span className="block text-sm font-medium text-ink">
                    {/* An unknown kind has no catalogue entry, so its humanised identifier is
                        the label — English in every locale, and a signal to add the key. */}
                    {copy.labelKey ? t(copy.labelKey) : copy.fallbackLabel}
                  </span>
                  {copy.descriptionKey && (
                    <span className="mt-0.5 block text-xs text-muted">
                      {t(copy.descriptionKey)}
                    </span>
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
