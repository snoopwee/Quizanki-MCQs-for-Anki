import { describe, expect, it } from "vitest";
import { absoluteUrl, siteUrl } from "./siteUrl";

describe("siteUrl", () => {
  it("prefers an explicitly configured domain", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://quizanki.app", VERCEL_URL: "x.vercel.app" }))
      .toBe("https://quizanki.app");
  });

  it("prefers Vercel's STABLE production host over the per-deployment one", () => {
    // VERCEL_URL changes on every redeploy, so a canonical built from it would rot.
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "quizanki.vercel.app", VERCEL_URL: "abc123.vercel.app" }))
      .toBe("https://quizanki.vercel.app");
  });

  it("adds the scheme Vercel omits", () => {
    expect(siteUrl({ VERCEL_URL: "abc123.vercel.app" })).toBe("https://abc123.vercel.app");
  });

  it("falls back to localhost in development", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
    expect(siteUrl({ PORT: "4000" })).toBe("http://localhost:4000");
  });

  it("drops a trailing slash so paths don't double up", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://quizanki.app/" })).toBe("https://quizanki.app");
  });
});

describe("absoluteUrl", () => {
  const env = { NEXT_PUBLIC_SITE_URL: "https://quizanki.app" };

  it("builds absolute URLs, which Open Graph requires", () => {
    expect(absoluteUrl("/user/hoangtester", env)).toBe("https://quizanki.app/user/hoangtester");
    expect(absoluteUrl("user/hoangtester", env)).toBe("https://quizanki.app/user/hoangtester");
  });

  it("leaves the root as the bare origin", () => {
    expect(absoluteUrl("/", env)).toBe("https://quizanki.app");
  });
});
