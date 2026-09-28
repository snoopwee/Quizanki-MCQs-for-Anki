import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // `robots.txt` and `sitemap.xml` are excluded deliberately. They are generated routes, not pages:
  // without this the middleware treats them as private (they aren't in PUBLIC_PATHS) and redirects
  // a crawler to the sign-in flow, which makes the entire sitemap unreachable. Excluding them here
  // rather than allow-listing them also skips a Supabase auth round-trip on every crawler request.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
