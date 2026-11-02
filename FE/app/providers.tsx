"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteGate } from "@/components/site/SiteGate";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locale";

export function Providers({
  children,
  // Read from the cookie on the SERVER and passed down — see LocaleProvider for why it
  // cannot be discovered in a mount effect the way the theme is.
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheReset />
      <LocaleProvider initialLocale={locale}>
        <SiteGate>{children}</SiteGate>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

// The QueryClient is a session-long singleton, so user-scoped cached data (decks,
// notes, deck contents) would leak across logins. Clear the whole cache whenever
// the signed-in user changes — on login, logout, or switching accounts — so the
// next screen refetches for the new user instead of showing the previous one's
// data until a manual reload.
function AuthCacheReset() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    // `undefined` = not yet initialised; the first event just records the
    // current user without clearing.
    let currentUserId: string | null | undefined = undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (currentUserId === undefined) {
        currentUserId = nextUserId;
        return;
      }
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        queryClient.clear();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return null;
}
