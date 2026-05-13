"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

type Me = {
  userId: string;
  email: string | null;
  role: string | null;
  expiresAt: string | null;
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Me>("/me")
      .then((res) => setMe(res.data))
      .catch((err) =>
        setError(err.response?.data?.message ?? err.message ?? "Failed"),
      );
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Confirms the Supabase JWT is being accepted by the Spring Boot API.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          GET /api/v1/me
        </h2>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!error && !me && <p className="text-sm">Loading…</p>}
        {me && (
          <pre className="overflow-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
{JSON.stringify(me, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
