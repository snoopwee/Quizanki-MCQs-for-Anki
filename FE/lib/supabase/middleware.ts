import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Auth is modal-first: there are no dedicated login/signup pages. The landing
// page ("/") hosts the auth modal; "/auth/callback" handles the Supabase email/
// OAuth redirect. "/shared/<deckId>" is a deck someone shared and "/discover" is
// the public directory of them — both must open for logged-out visitors (that's
// the whole point); they host the auth modal themselves for the "save a copy"
// step.
const PUBLIC_PATHS = ["/", "/try", "/auth/callback", "/shared", "/discover", "/authors"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    // Send them to the landing page, which opens the auth modal and returns them
    // to `next` once authenticated.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged-in users' home is the dashboard, not the marketing landing page.
  // Skip the redirect when `?next=` is present so the post-login round-trip
  // (modal opens on /, redirects to next on success) still works.
  if (user && path === "/" && !request.nextUrl.searchParams.get("next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
