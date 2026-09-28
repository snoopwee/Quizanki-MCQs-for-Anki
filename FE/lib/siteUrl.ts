/**
 * The site's own absolute URL, which metadata cannot do without: Open Graph tags must carry
 * absolute URLs, so a relative one silently produces a link preview with no image and no canonical.
 *
 * Resolution order, each step a real case:
 *   1. `NEXT_PUBLIC_SITE_URL` — the custom domain, once there is one. Always wins.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — the stable production hostname Vercel injects. Survives
 *      redeploys, unlike VERCEL_URL.
 *   3. `VERCEL_URL` — the per-deployment hostname. Right for a preview, wrong for production, so
 *      it is the last of the deployed options.
 *   4. localhost — development.
 *
 * Vercel's variables carry no scheme, so one is added; a configured value is trusted as given, but
 * a trailing slash is dropped either way (`${base}/x` must not become `//x`).
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return stripTrailingSlash(withScheme(configured));
  }

  const vercel =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  if (vercel) {
    return stripTrailingSlash(withScheme(vercel));
  }

  const port = env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

/** An absolute URL for a path, for canonicals and Open Graph. */
export function absoluteUrl(path: string, env?: Record<string, string | undefined>): string {
  const base = siteUrl(env);
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function withScheme(host: string): string {
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
