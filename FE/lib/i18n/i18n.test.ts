import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_NAMES,
  isLocale,
  localeCookieAssignment,
  localeFromCookie,
  localeFromDocumentCookie,
  preferredLocale,
} from "./locale";
import { translate, type Message } from "./translate";
import { en } from "./messages/en";
import { vi } from "./messages/vi";

describe("locale validation", () => {
  it("accepts the languages we ship and nothing else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("falls back to English for a cookie that is absent or junk", () => {
    // The cookie is user-editable, so anything can arrive here.
    expect(localeFromCookie(undefined)).toBe(DEFAULT_LOCALE);
    expect(localeFromCookie(null)).toBe(DEFAULT_LOCALE);
    expect(localeFromCookie("")).toBe(DEFAULT_LOCALE);
    expect(localeFromCookie("klingon")).toBe(DEFAULT_LOCALE);
    expect(localeFromCookie("../../etc/passwd")).toBe(DEFAULT_LOCALE);
  });

  it("names each language in that language, not in English", () => {
    // "Vietnamese" is no use to somebody who cannot read English — which is the whole audience
    // for this control.
    expect(LOCALE_NAMES.vi).toBe("Tiếng Việt");
    expect(LOCALE_NAMES.en).toBe("English");
  });
});

describe("reading the cookie out of document.cookie", () => {
  it("finds ours among others", () => {
    expect(
      localeFromDocumentCookie(`sb-auth=xyz; ${LOCALE_COOKIE}=vi; quizanki:theme=dark`),
    ).toBe("vi");
  });

  it("is not fooled by a cookie whose name merely ends with ours", () => {
    // A naive `includes()` would read "other_quizanki_locale=vi" as a Vietnamese preference.
    expect(localeFromDocumentCookie("other_quizanki_locale=vi")).toBe(DEFAULT_LOCALE);
  });

  it("returns the default when there are no cookies at all", () => {
    expect(localeFromDocumentCookie("")).toBe(DEFAULT_LOCALE);
  });
});

describe("the stored cookie", () => {
  it("lasts a year, covers the whole site, and survives a cross-site arrival", () => {
    const assignment = localeCookieAssignment("vi");
    expect(assignment).toContain(`${LOCALE_COOKIE}=vi`);
    expect(assignment).toContain("path=/");
    expect(assignment).toContain("max-age=31536000");
    // SameSite=Strict would withhold the cookie when somebody opens a shared deck link from a
    // chat app — the first page they ever see would be in the wrong language.
    expect(assignment).toContain("SameSite=Lax");
  });
});

describe("preferredLocale", () => {
  it("matches a Vietnamese browser on the primary subtag", () => {
    expect(preferredLocale(["vi-VN", "en-US"])).toBe("vi");
    expect(preferredLocale(["vi"])).toBe("vi");
  });

  it("takes the first language it recognises, in the browser's own order", () => {
    expect(preferredLocale(["fr-FR", "vi-VN"])).toBe("vi");
    expect(preferredLocale(["en-GB", "vi-VN"])).toBe("en");
  });

  it("falls back to English when nothing matches", () => {
    expect(preferredLocale(["fr", "de"])).toBe(DEFAULT_LOCALE);
    expect(preferredLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe("translate", () => {
  const messages = {
    plain: "Log in",
    greet: "Hello {name}",
    two: "{a} then {b}",
    cards: { one: "{count} card", other: "{count} cards" },
  };

  it("returns a plain string", () => {
    expect(translate(messages, "plain")).toBe("Log in");
  });

  it("splices variables in", () => {
    expect(translate(messages, "greet", { name: "Mai" })).toBe("Hello Mai");
    expect(translate(messages, "two", { a: "this", b: "that" })).toBe("this then that");
  });

  it("picks the English plural form on count, treating 0 as plural", () => {
    expect(translate(messages, "cards", { count: 1 })).toBe("1 card");
    expect(translate(messages, "cards", { count: 8 })).toBe("8 cards");
    expect(translate(messages, "cards", { count: 0 })).toBe("0 cards");
  });

  it("returns THE KEY for a message that does not exist", () => {
    // Deliberate: "auth.logIn" on a button is an obvious bug someone fixes. Rendering nothing,
    // or crashing, is worse.
    expect(translate(messages, "nope.missing")).toBe("nope.missing");
  });

  it("leaves an unsupplied placeholder visibly unreplaced", () => {
    // "Hello {name}" gets noticed and fixed; "Hello " looks like a spacing slip and survives.
    expect(translate(messages, "greet")).toBe("Hello {name}");
    expect(translate(messages, "greet", { other: "x" })).toBe("Hello {name}");
  });

  it("accepts a plain string where English needs plural forms", () => {
    // Vietnamese nouns do not inflect for number — "1 thẻ" and "8 thẻ" are the same word — so a
    // translation must not be forced to write the sentence twice.
    const viLike = { cards: "{count} thẻ" };
    expect(translate(viLike, "cards", { count: 1 })).toBe("1 thẻ");
    expect(translate(viLike, "cards", { count: 8 })).toBe("8 thẻ");
  });
});

describe("the catalogues", () => {
  it("cover exactly the same keys", () => {
    // The TYPE already enforces this at compile time; this catches the case where someone
    // silences it with a cast, and it names the offending keys instead of pointing at a line.
    const enKeys = Object.keys(en).sort();
    const viKeys = Object.keys(vi).sort();
    expect(viKeys).toEqual(enKeys);
  });

  it("leaves no entry empty", () => {
    for (const [locale, catalogue] of [["en", en], ["vi", vi]] as const) {
      // Typed as Message rather than inferred: every entry happens to be a plain string today,
      // which narrows the union away and makes the plural branch unreachable to the compiler.
      for (const [key, value] of Object.entries(catalogue as Record<string, Message>)) {
        const text = typeof value === "string" ? value : value.other;
        expect(text.trim(), `${locale}: ${key} is empty`).not.toBe("");
      }
    }
  });

  it("is actually translated — Vietnamese is not a copy of English", () => {
    // Guards the lazy failure mode where a key gets added to both files with the English text
    // pasted into vi.ts and never revisited.
    const shared = (Object.keys(en) as (keyof typeof en)[]).filter(
      (k) => typeof en[k] === "string" && typeof vi[k] === "string",
    );
    const identical = shared.filter((k) => en[k] === vi[k]);
    // Some entries are LEGITIMATELY identical: "Email" is the same word in Vietnamese, and a
    // numeric size bucket ("20–50") is the same in every language. Everything else differing is
    // what proves the catalogue was actually translated rather than pasted across.
    expect(identical.sort()).toEqual(
      ["auth.email", "size.100plus", "size.20to50", "size.50to100"].sort(),
    );
  });

  it("keeps the reset-sent message free of any account-existence hint, in BOTH languages", () => {
    // The user-enumeration guard has to survive translation. A helpful translator adding
    // "if you are registered" would reopen exactly the leak this sentence closes.
    expect(en["auth.resetSent"]).toMatch(/if that address has an account/i);
    expect(en["auth.resetSent"]).not.toMatch(/\bno account\b|not found|unregistered/i);
    expect(vi["auth.resetSent"]).toMatch(/nếu/i);
    expect(vi["auth.resetSent"]).toMatch(/spam/i);
  });

  it("ships every locale we advertise", () => {
    expect(Object.keys(LOCALE_NAMES).sort()).toEqual([...LOCALES].sort());
  });
});
