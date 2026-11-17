import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { en } from "./messages/en";

/**
 * Every catalogue key must be referenced by something that renders.
 *
 * <p><b>Why this test exists.</b> On 2026-11-16 twelve keys had a complete Vietnamese
 * translation that nothing used — the key was added to both catalogues and the component was
 * never changed, so the screen kept showing English. `deckPage.backToDecks` had three separate
 * call sites and none of them had been converted.
 *
 * <p>Nothing else catches it. `CatalogueOf<typeof en>` only checks that `vi` has the same keys as
 * `en`; the "not a copy of English" test only checks the values differ; typecheck and lint see
 * nothing wrong with a component that renders a string literal. The catalogue looks finished and
 * the UI is still English — the one i18n invariant the rest of the suite cannot express.
 *
 * <p>It matches the quoted key rather than `t("…")` on purpose, so indirect uses still count:
 * `labelKey: "notifKind.newFollower"` in a module-level table, or a key handed to `t` through a
 * variable, are both real references.
 */

const FE_ROOT = resolve(__dirname, "../..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".playwright-mcp",
  "public",
  "coverage",
]);
/** The catalogues themselves: every key appears there by definition, so they cannot be evidence. */
const CATALOGUE_DIR = join("lib", "i18n", "messages");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !full.includes(CATALOGUE_DIR)) {
      out.push(full);
    }
  }
  return out;
}

describe("catalogue keys are all referenced", () => {
  it("has no dead keys — a translation nothing renders is invisible work", () => {
    const files = sourceFiles(FE_ROOT);
    // One pass over the tree; 400+ keys x hundreds of files is too slow file-by-file.
    const haystack = files.map((f) => readFileSync(f, "utf8")).join("\n");

    const dead = Object.keys(en).filter((key) => !haystack.includes(`"${key}"`));

    expect(
      dead,
      dead.length
        ? `These keys are translated but never referenced, so the UI still shows English:\n` +
            dead.map((k) => `  - ${k}`).join("\n") +
            `\nWire them to their call site, or delete the key if the copy is gone.`
        : "",
    ).toEqual([]);
  });

  it("actually reads source files — guards against the sweep silently finding nothing", () => {
    // If the walk broke (a renamed directory, a changed layout), `dead` above would be empty for
    // the wrong reason and the test would pass while checking nothing.
    const files = sourceFiles(FE_ROOT);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith("layout.tsx"))).toBe(true);
  });
});
