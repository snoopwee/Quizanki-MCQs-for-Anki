import { redirect } from "next/navigation";

// The trial flow now lives on the landing page ("/"). Kept as a redirect so any
// existing /try links keep working.
export default function TryPage() {
  redirect("/");
}
