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
  //
  // ⚠ STATIC ASSET EXTENSIONS MUST BE LISTED HERE. Anything served from `public/` that is not
  // excluded is treated as a private page and 307s to sign-in. The font files added 2026-11-16
  // were redirected for exactly this reason — `woff2` was not in the list, so a signed-out
  // visitor's browser got a redirect instead of a typeface and the whole site fell back to
  // system fonts. Caught by requesting the file, not by any test.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf|eot)$).*)",
  ],
};
