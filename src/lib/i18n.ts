/**
 * Locale and translation helpers for Phase 8 Pashto support.
 *
 * Locale is stored in a `shop_locale` cookie (`en` or `ps`), defaulting to English.
 * Each browser remembers its own choice; no database migration is needed.
 *
 * All functions here read cookies, so they are server-only and safe to call from
 * server components and server actions. They must not be imported into client
 * components.
 *
 * The translation dictionaries live in src/lib/dictionary.ts so client
 * components can render translated strings without importing server-only code.
 */

import { cookies } from "next/headers";

import { COOKIE_NAME, DICTIONARIES, LOCALES, translate, type Locale } from "./dictionary";

export type { Locale };
export { LOCALES, DICTIONARIES, COOKIE_NAME };

/** Read the shopkeeper's chosen locale from the cookie. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  const value = cookieStore.get(COOKIE_NAME)?.value;

  return value === "en" || value === "ps" ? value : "en";
}

/** The writing direction for a locale. Pashto is right-to-left. */
export async function getDirection(locale?: Locale): Promise<"ltr" | "rtl"> {
  const loc = locale ?? (await getLocale());

  return loc === "ps" ? "rtl" : "ltr";
}

/** Look up a translated string for the current locale, falling back to English. */
export async function t(
  key: string,
  params?: Record<string, string>,
): Promise<string> {
  const locale = await getLocale();

  return translate(locale, key, params);
}
