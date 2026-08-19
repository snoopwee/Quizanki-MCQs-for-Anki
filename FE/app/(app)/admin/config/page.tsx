"use client";

import { useEffect, useState } from "react";
import { useSiteConfig, useUpdateSiteConfig } from "@/hooks/useSiteConfig";
import { Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/shared/Toast";
import { Icon } from "@/components/ui/icons";

const inputClasses =
  "focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint";

// Live site settings. Saving takes effect on every client's next read of the public
// config — no redeploy. Maintenance mode blanks the site for non-admins; the
// announcement shows as a banner to everyone.
export default function AdminConfigPage() {
  const config = useSiteConfig();
  const update = useUpdateSiteConfig();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Seed the form once the current settings load.
  useEffect(() => {
    if (config.data) {
      setMaintenanceMode(config.data.maintenanceMode);
      setMaintenanceMessage(config.data.maintenanceMessage ?? "");
      setAnnouncement(config.data.announcement ?? "");
    }
  }, [config.data]);

  function save() {
    setToast(null);
    update.mutate(
      {
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim() || null,
        announcement: announcement.trim() || null,
      },
      {
        onSuccess: () => setToast({ kind: "success", message: "Settings saved — live now." }),
        onError: () => setToast({ kind: "error", message: "Couldn't save settings. Try again." }),
      },
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Site config</h1>
        <p className="mt-1 text-sm text-muted">
          Live settings for the whole site. Changes apply on each visitor&apos;s next load — no deploy.
        </p>
      </header>

      {config.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted">
          <Spinner className="h-5 w-5 text-accent" /> Loading settings…
        </div>
      ) : config.isError ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-sm text-danger">
          Couldn&apos;t load settings.
        </p>
      ) : (
        <>
          {/* maintenance */}
          <section className="space-y-3 rounded-card border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Icon name="settings" size={16} className="text-muted" />
                <span className="text-sm font-semibold text-ink">Maintenance mode</span>
              </div>
              <Segmented
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
                value={maintenanceMode ? "on" : "off"}
                onChange={(v) => setMaintenanceMode(v === "on")}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              When on, visitors see a maintenance screen. <span className="font-medium text-ink">Admins
              still get in</span> so you can keep working.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Message (optional)</span>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="We'll be back shortly…"
                className={inputClasses}
              />
            </label>
          </section>

          {/* announcement */}
          <section className="space-y-3 rounded-card border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <Icon name="bolt" size={16} className="text-muted" />
              <span className="text-sm font-semibold text-ink">Announcement banner</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Shown to everyone as a dismissible banner. Leave empty for no banner.
            </p>
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. New: True/False questions are live!"
              className={inputClasses}
            />
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={update.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-5 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
            >
              {update.isPending && <Spinner className="h-4 w-4" />}
              Save settings
            </button>
          </div>
        </>
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
