import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

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
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-5">
          <span className="font-semibold">AnkiQuiz</span>
          <nav className="flex items-center gap-4 text-sm text-neutral-500">
            <Link href="/dashboard" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Dashboard
            </Link>
            <Link href="/import" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Import
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
