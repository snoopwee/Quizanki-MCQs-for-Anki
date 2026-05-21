"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

type Authentication = {
  userId: string;
  email: string | null;
  role: string | null;
  expiresAt: string | null;
};

export default function DashboardPage() {
  const [authentication, setAuthentication] = useState<Authentication | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Authentication>("/authentication")
      .then((res) => setAuthentication(res.data))
      .catch((err) => {
        if (err.response) {
          const body =
            typeof err.response.data === "string"
              ? err.response.data
              : JSON.stringify(err.response.data);
          setError(`HTTP ${err.response.status} — ${body || "(empty body)"}`);
        } else {
          setError(`Network error — ${err.message}`);
        }
      });
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
          GET /api/v1/authentication
        </h2>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!error && !authentication && <p className="text-sm">Loading…</p>}
        {authentication && (
          <pre className="overflow-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
{JSON.stringify(authentication, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
