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
 * Translations are a first draft for review by a Pashto speaker (see the open
 * question in docs/progress-tracker.md). Brand names stay in English.
 */

import { cookies } from "next/headers";

export type Locale = "en" | "ps";

export const LOCALES: readonly Locale[] = ["en", "ps"];

export const COOKIE_NAME = "shop_locale";
const DEFAULT_LOCALE: Locale = "en";

/** Read the shopkeeper's chosen locale from the cookie. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  const value = cookieStore.get(COOKIE_NAME)?.value;

  return value === "en" || value === "ps" ? value : DEFAULT_LOCALE;
}

/** The writing direction for a locale. Pashto is right-to-left. */
export async function getDirection(locale?: Locale): Promise<"ltr" | "rtl"> {
  const loc = locale ?? (await getLocale());

  return loc === "ps" ? "rtl" : "ltr";
}

type Dictionary = Record<string, string>;

const en: Dictionary = {
  // Brand
  "app.name": "AI Shopkeeper",
  "app.title": "AI Shopkeeper Assistant",

  // Main navigation
  "nav.dashboard": "Dashboard",
  "nav.sell": "Sell",
  "nav.products": "Products",
  "nav.sales": "Sales",
  "nav.customers": "Customers",
  "nav.reports": "Reports",
  "nav.more": "More",
  "nav.signOut": "Sign out",
  "nav.signedInAs": "Signed in as {{user}}",

  // Page headings
  "page.dashboard": "Dashboard",
  "page.sell": "Sell",
  "page.products": "Products",
  "page.sales": "Sales",
  "page.customers": "Customers",
  "page.reports": "Reports",
  "page.more": "More tools",
  "page.assistant": "Assistant",
  "page.login": "Sign in",

  // Common actions
  "action.addProduct": "Add product",
  "action.newSale": "New sale",
  "action.search": "Search",
  "action.clearSearch": "Clear search",
  "action.confirm": "Confirm",
  "action.dismiss": "Dismiss",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.edit": "Edit",
  "action.view": "View",
  "action.back": "Back",

  // Common labels
  "label.total": "Total",
  "label.stock": "Stock",
  "label.customer": "Customer",
  "label.date": "Date",
  "label.amount": "Amount",
  "label.note": "Note",

  // Assistant
  "assistant.empty.title": "What would you like to know?",
  "assistant.empty.body":
    "Try one of these, or ask me to prepare a sale, expense, or payment. Nothing is saved until you confirm it.",
  "assistant.checking": "Checking the shop…",
  "assistant.userLabel": "You",
  "assistant.assistantLabel": "Assistant",
  "assistant.checked": "Checked:",
  "assistant.placeholder": "Ask about sales, stock, credit, or cash…",
  "assistant.askButton": "Ask",
  "assistant.readOnlyBadge": "Read-only · confirm to save",
  "assistant.subtitle":
    "Ask about sales, stock, credit, expenses, or cash. You can also ask the assistant to prepare a sale, expense, or khata payment; nothing is saved until you press the matching Confirm button.",
  "assistant.setup.title": "The assistant is not configured yet",
  "assistant.setup.body":
    "The rest of the app works normally. To turn the assistant on, add these values to .env and restart the app:",

  // More page
  "more.subtitle": "The less frequent jobs, kept out of the way.",
  "more.assistant.title": "Assistant",
  "more.assistant.body": "Ask about sales, stock, credit, expenses, and cash. Read-only.",
  "more.expenses.title": "Expenses",
  "more.expenses.body": "Record rent, bills, salaries, and other shop costs.",
  "more.dayClose.title": "Day close",
  "more.dayClose.body": "Compare counted cash with the cash the app expects.",
  "more.backups.title": "Backups",
  "more.backups.body": "Make a copy of the shop database and see past backups.",
  "more.audit.title": "Audit log",
  "more.audit.body": "See every money and stock change in one place.",
};

const ps: Dictionary = {
  // Brand
  "app.name": "AI Shopkeeper",
  "app.title": "د دکنی AI مددګر",

  // Main navigation
  "nav.dashboard": "داشبورد",
  "nav.sell": "فروختن",
  "nav.products": "معودونه",
  "nav.sales": "فروخت",
  "nav.customers": "مشتریان",
  "nav.reports": "گزارشونه",
  "nav.more": "زیاتې",
  "nav.signOut": "ښکله کول",
  "nav.signedInAs": "لېدې {{user}}",

  // Page headings
  "page.dashboard": "داشبورد",
  "page.sell": "فروختن",
  "page.products": "معودونه",
  "page.sales": "فروخت",
  "page.customers": "مشتریان",
  "page.reports": "گزارشونه",
  "page.more": "زیاتې کارونه",
  "page.assistant": "مددګر",
  "page.login": "ورکول",

  // Common actions
  "action.addProduct": "معودة ته ورکول",
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, ps };

/** Look up a translated string for the current locale, falling back to English. */
export async function t(
  key: string,
  params?: Record<string, string>,
): Promise<string> {
  const locale = await getLocale();

  const dict = DICTIONARIES[locale];

  let text = dict[key] ?? en[key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{\\s*${name}\\s*}}`, "g"), value);
    }
  }

  return text;
}

export { DICTIONARIES };
