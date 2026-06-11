import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware already redirects with a `next` param; this is the fallback.
    redirect("/");
  }

  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
