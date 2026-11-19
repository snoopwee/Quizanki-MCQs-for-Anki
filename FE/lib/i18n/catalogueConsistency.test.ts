import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/messages/en";
import { vi } from "@/lib/i18n/messages/vi";
import type { Message } from "@/lib/i18n/translate";

/**
 * What `CatalogueOf<typeof en>` does NOT catch.
 *
 * <p>The type guarantees both catalogues have the same KEYS. It says nothing about the contents,
 * so a translation can typecheck and still be wrong on screen. `translate()` leaves an unmatched
 * placeholder visibly unreplaced, so a dropped `{count}` is not a silent degradation — it renders
 * a literal brace to the reader.
 *
 * <p>Verified these assertions actually fail by planting three canaries (a dropped placeholder,
 * an untranslated string, an unbalanced brace) and watching each one get caught.
 */

const PLACEHOLDER = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Every string a message can render: a plain one, or both plural forms. */
function forms(message: Message): string[] {
  return typeof message === "string" ? [message] : [message.one, message.other];
}

function placeholders(message: Message): Set<string> {
  const found = new Set<string>();
  for (const form of forms(message)) {
    for (const m of form.matchAll(PLACEHOLDER)) found.add(m[1]);
  }
  return found;
}

const keys = Object.keys(en) as (keyof typeof en)[];

describe("catalogue consistency", () => {
  it("gives every key the same placeholders in both languages", () => {
    // A placeholder dropped from a translation means the value never reaches the reader; one the
    // caller does not supply renders as a literal "{name}".
    const mismatched: string[] = [];
    for (const key of keys) {
      const a = placeholders(en[key]);
      const b = placeholders(vi[key]);
      const missing = [...a].filter((p) => !b.has(p));
      const extra = [...b].filter((p) => !a.has(p));
      if (missing.length || extra.length) {
        mismatched.push(`${key}: missing=[${missing}] extra=[${extra}]`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("has no empty or whitespace-only message in either language", () => {
    const blank: string[] = [];
    for (const key of keys) {
      for (const [lang, cat] of [
        ["en", en],
        ["vi", vi],
      ] as const) {
        for (const form of forms(cat[key])) {
          if (!form.trim()) blank.push(`${lang} ${key}`);
        }
      }
    }
    expect(blank).toEqual([]);
  });

  it("balances every brace, so no stray { reaches the screen", () => {
    const unbalanced: string[] = [];
    for (const key of keys) {
      for (const [lang, cat] of [
        ["en", en],
        ["vi", vi],
      ] as const) {
        for (const form of forms(cat[key])) {
          const opens = (form.match(/\{/g) ?? []).length;
          const closes = (form.match(/\}/g) ?? []).length;
          if (opens !== closes) unbalanced.push(`${lang} ${key}`);
        }
      }
    }
    expect(unbalanced).toEqual([]);
  });

  it("has no Vietnamese entry that is still untranslated English prose", () => {
    // ASCII-only with three consecutive lowercase words. Real Vietnamese that long without a
    // single diacritic does not occur in this catalogue; the allowlist is for the genuine
    // exceptions, which are proper nouns and format examples rather than prose.
    const ALLOW = new Set<string>([
      "import.pastePlaceholder", // "term<TAB>definition" -- a format example, words translated
    ]);
    const suspicious: string[] = [];
    for (const key of keys) {
      if (ALLOW.has(key)) continue;
      for (const form of forms(vi[key])) {
        const asciiOnly = /^[\x00-\x7F]*$/.test(form);
        const threeWords = /\b[a-z]{2,} [a-z]{2,} [a-z]{2,}\b/.test(form);
        if (asciiOnly && threeWords) suspicious.push(`${key}: ${form.slice(0, 60)}`);
      }
    }
    expect(suspicious).toEqual([]);
  });
});
