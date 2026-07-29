import type { IconName } from "@/components/ui/icons";

// The admin sidebar's sections, in order. This is the single place to grow the
// admin surface: when a new feature needs an admin screen — moderation, a queue,
// a settings panel, anything that "goes through admin" — add a row here and it
// appears in the admin sidebar. Flip `ready` to true once the route exists; until
// then it shows as a muted "soon" item so the roadmap is visible but unclickable.
export type AdminSection = {
  href: string;
  label: string;
  icon: IconName;
  ready: boolean;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", label: "Overview", icon: "target", ready: true },
  { href: "/admin/decks", label: "Moderate decks", icon: "layers", ready: false },
  { href: "/admin/users", label: "Users", icon: "user", ready: false },
  { href: "/admin/reports", label: "Reports", icon: "clipboard", ready: false },
  { href: "/admin/config", label: "Site config", icon: "settings", ready: false },
];
