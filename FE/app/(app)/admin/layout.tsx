"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

// The admin area. Navigation lives in the admin sidebar (AppShell swaps to it when
// an admin is signed in), so this layout is just the access guard + a container.
//
// The guard is UX only — the backend gates every /api/v1/admin/** endpoint on
// ROLE_ADMIN, so a non-admin who forces their way here still gets no data. We check
// GET /me and bounce non-admins back Home rather than flash admin chrome at them.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const isAdmin = me.data?.isAdmin ?? false;

  useEffect(() => {
    if (me.isSuccess && !me.data.isAdmin) router.replace("/home");
  }, [me.isSuccess, me.data, router]);

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner className="h-5 w-5 text-accent" /> Checking access…
      </div>
    );
  }

  // Not an admin (or /me failed): a clear wall while the redirect above runs.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
          <Icon name="lock" size={24} />
        </span>
        <h1 className="mt-3 font-display text-lg font-semibold text-ink">Admins only</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
          This area is restricted. Taking you back home…
        </p>
        <Link
          href="/home"
          className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
        >
          Go home
        </Link>
      </div>
    );
  }

  return <div className="mx-auto max-w-6xl">{children}</div>;
}
