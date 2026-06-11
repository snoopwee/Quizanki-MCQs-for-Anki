"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className={buttonClasses({ variant: "ghost", size: "sm", className: "w-full" })}
    >
      <Icon name="signOut" size={16} /> Sign out
    </button>
  );
}
