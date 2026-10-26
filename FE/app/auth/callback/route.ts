import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readEmailOtpType, safeNextPath } from "@/lib/authCallback";

/**
 * Handles the redirect back from Supabase after email confirmation or OAuth.
 *
 * <p>Two link shapes arrive here, and it must understand both:
 *
 * <ul>
 *   <li><b>{@code ?code=}</b> — PKCE, used by OAuth and by anything supabase-js initiated in this
 *       browser. Exchanged for a session. Only completable in the browser that started it.</li>
 *   <li><b>{@code ?token_hash=&type=}</b> — verified server-side against the account, so it works
 *       in <i>any</i> browser. This is the shape to point email templates at, and the only one
 *       that survives someone opening the email on a different device.</li>
 * </ul>
 *
 * <p>⚠ The {@code token_hash} branch exists <b>before</b> any email template asks for it, on
 * purpose. On 2026-10-26 the password-reset template was switched to {@code token_hash} while the
 * code that reads it was still unmerged, and every reset email became a dead end for as long as
 * that gap lasted. A provider's dashboard setting is a deploy with no staging environment: the
 * code half has to be able to sit harmlessly ahead of the config half.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = readEmailOtpType(searchParams.get("type"));
  const next = safeNextPath(searchParams.get("next"));

  // token_hash first: when a link somehow carries both, it is the one that works everywhere.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=callback_failed`);
}
