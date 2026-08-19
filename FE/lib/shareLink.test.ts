import { describe, expect, it } from "vitest";
import { buildShareUrl } from "@/lib/shareLink";

describe("buildShareUrl", () => {
  it("builds the public share path from an origin", () => {
    expect(buildShareUrl("https://quizanki.app", "d1")).toBe("https://quizanki.app/shared/d1");
  });

  it("doesn't double the slash when the origin has a trailing one", () => {
    expect(buildShareUrl("http://localhost:3000/", "abc")).toBe(
      "http://localhost:3000/shared/abc",
    );
  });

  it("collapses several trailing slashes", () => {
    expect(buildShareUrl("https://quizanki.app///", "d1")).toBe("https://quizanki.app/shared/d1");
  });
});
