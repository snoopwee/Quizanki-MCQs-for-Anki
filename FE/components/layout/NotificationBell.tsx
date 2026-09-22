"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton, iconButtonIconSize } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { inAppHref, relativeTime, unreadBadge, unreadLabel } from "@/lib/notificationDisplay";
import type { NotificationResponse } from "@/types/api";

// The notification bell, beside the streak chip in the top bar. Closed, it costs one count; open,
// it fetches one page of rows. Clicking a row marks it read and follows its link.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const router = useRouter();

  const unread = useUnreadNotificationCount();
  const page = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // Same dismissal contract as KebabMenu: outside click, Escape, or choosing something.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One number from one place. The page response carries its own `unread`, but this query is
  // mounted on every screen anyway and every mutation invalidates the whole `["notifications"]`
  // prefix, so reading two sources could only disagree.
  const count = unread.data ?? 0;
  const badge = unreadBadge(count);
  const items = page.data?.items ?? [];
  const hidden = (page.data?.total ?? 0) - items.length;

  function openRow(notification: NotificationResponse) {
    if (!notification.read) markRead.mutate(notification.id);
    // `link` is a snapshot the server wrote; inAppHref refuses anything that would leave the app.
    const href = inAppHref(notification.link);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/* A peer action beside the streak chip and New deck, so it takes the bordered circle
          (DESIGN_SYSTEM → Equal containers) rather than a hand-rolled box. */}
      <IconButton
        label={unreadLabel(count)}
        bordered
        ariaHasPopup="menu"
        ariaExpanded={open}
        ariaControls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={open ? "text-ink" : "text-muted hover:text-ink"}
      >
        <Icon name="bell" size={iconButtonIconSize("md")} />
      </IconButton>

      {badge && (
        // Decorative: the count is already in the button's accessible name, and a live region
        // here would announce the badge again on every poll.
        <span
          aria-hidden
          className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-bold leading-none text-white"
        >
          {badge}
        </span>
      )}

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Notifications"
          // Mirrors MENU_SURFACE (components/ui/menu.ts) minus its `max-h`/scroll: this panel keeps
          // a header pinned above a scrolling list, and its rows WRAP onto two lines — which
          // MENU_ITEM's single-line `whitespace-nowrap` rows can't express.
          className="absolute right-0 z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-1 shadow-card"
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="font-display text-sm font-semibold text-ink">Notifications</span>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className="focus-ring rounded-input px-1.5 py-0.5 text-xs font-semibold text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
            >
              {markAll.isPending ? "Marking…" : "Mark all read"}
            </button>
          </div>

          <div className="nice-scroll max-h-80 overflow-y-auto overflow-x-hidden">
            {page.isLoading ? (
              <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted">
                <Spinner className="h-4 w-4 text-accent" /> Loading…
              </p>
            ) : page.isError ? (
              <p className="px-2 py-6 text-sm text-danger">Couldn&apos;t load your notifications.</p>
            ) : items.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon name="bell" size={18} />
                </span>
                <p className="text-sm font-medium text-ink">Nothing yet.</p>
                <p className="mt-0.5 text-xs text-muted">
                  Decks shared with you, new decks from authors you follow, and news from us land
                  here.
                </p>
              </div>
            ) : (
              <ul>
                {items.map((notification) => (
                  <li key={notification.id}>
                    <Row notification={notification} onOpen={() => openRow(notification)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hidden > 0 && (
            <p className="border-t border-line px-2 py-1.5 font-mono text-[0.6875rem] text-faint">
              Showing the newest {items.length} of {page.data?.total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  notification,
  onOpen,
}: {
  notification: NotificationResponse;
  onOpen: () => void;
}) {
  const href = inAppHref(notification.link);
  const age = relativeTime(notification.createdAt);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onOpen}
      className={`focus-ring flex w-full items-start gap-2.5 rounded-[8px] px-2 py-2 text-left transition hover:bg-surface-2 ${
        href ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          notification.read ? "bg-surface-2 text-faint" : "bg-accent-soft text-accent"
        }`}
      >
        <Icon name={kindIcon(notification.kind)} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={`min-w-0 flex-1 text-sm ${
              notification.read ? "font-medium text-muted" : "font-semibold text-ink"
            }`}
          >
            {notification.title}
          </span>
          {age && <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{age}</span>}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{notification.body}</span>
        )}
      </span>
      {!notification.read && (
        <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
      )}
    </button>
  );
}

// A row's kind is a plain string on purpose: a backend newer than this client can send one we've
// never heard of, and it must still render.
function kindIcon(kind: string): IconName {
  if (kind === "deck_shared") return "cards";
  if (kind === "author_published") return "user";
  if (kind === "announcement") return "bolt";
  return "bell";
}
