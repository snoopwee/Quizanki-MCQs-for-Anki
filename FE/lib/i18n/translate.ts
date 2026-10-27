// Message lookup: the whole translation engine, deliberately about forty lines.
//
// Why not next-intl or i18next: the one thing those buy that is genuinely hard — locale-routed
// URLs — is the thing the product decided NOT to have (a Settings toggle, no /vi/ prefix). What is
// left is variable interpolation and a plural rule, which is this file. Revisit if a third language
// with real plural categories (Polish, Arabic, Russian) ever arrives; en + vi do not need CLDR.

/**
 * One entry in a catalogue.
 *
 * <p>A plain string, or the two English plural forms. **Vietnamese is deliberately allowed to be a
 * plain string where English needs both forms** — Vietnamese nouns do not inflect for number
 * ("1 thẻ", "8 thẻ"), and forcing a `{one, other}` pair there would mean writing the same sentence
 * twice and inviting them to drift apart.
 */
export type Message = string | { one: string; other: string };

export type Catalogue = Record<string, Message>;

/** Values spliced into `{placeholders}`. */
export type Vars = Record<string, string | number>;

/**
 * Pick the plural form.
 *
 * <p>English only: exactly 1 is singular, everything else — including 0 — is plural ("0 cards").
 * Vietnamese never reaches here, because its entries are plain strings.
 */
function pickForm(message: Message, vars: Vars | undefined): string {
  if (typeof message === "string") return message;
  const count = vars?.count;
  return count === 1 ? message.one : message.other;
}

/**
 * Replace every `{name}` with its variable.
 *
 * <p>An unmatched placeholder is left exactly as written rather than becoming an empty string:
 * "You have {count} decks" on screen is an obvious bug that gets fixed, whereas "You have  decks"
 * reads like a spacing slip and survives for months.
 */
function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * The translated string for `key`.
 *
 * <p>A key with no entry returns **the key itself**. That is on purpose: a missing translation
 * should look obviously missing ("landing.cta.start" on a button) rather than crash the page or
 * silently render nothing. It also makes an untranslated screen findable by searching for a dot.
 */
export function translate(messages: Catalogue, key: string, vars?: Vars): string {
  const message = messages[key];
  if (message === undefined) return key;
  return interpolate(pickForm(message, vars), vars);
}

/** The shape a translated catalogue must satisfy: every key English defines, and no new ones. */
export type CatalogueOf<T extends Catalogue> = Record<keyof T, Message>;
