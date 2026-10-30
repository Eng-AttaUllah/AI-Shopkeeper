/**
 * Translation dictionaries for Phase 8 Pashto support.
 *
 * Pure data with no server-only imports, so client components can use them
 * directly. The server-side helper in src/lib/i18n.ts re-uses these
 * dictionaries and resolves the locale from the `shop_locale` cookie.
 *
 * Translations are a first draft for review by a Pashto speaker (see the open
 * question in docs/progress-tracker.md). Brand names stay in English. Keys
 * missing from `ps` fall back to English.
 */

export type Locale = "en" | "ps";

export const LOCALES: readonly Locale[] = ["en", "ps"];

const COOKIE_NAME = "shop_locale";

export { COOKIE_NAME };

/** Read the locale cookie on the client. Safe to call lazily; not run at module load. */
export function readClientLocale(): Locale {
  if (typeof document === "undefined") {
    return "en";
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`),
  );

  const value = match?.[1];

  return value === "en" || value === "ps" ? value : "en";
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
  "assistant.suggestion.salesToday": "How much did I sell today?",
  "assistant.suggestion.lowStock": "What is low in stock?",
  "assistant.suggestion.topDebt": "Who owes me the most?",
  "assistant.suggestion.netProfit": "What was my net profit this month?",
  "assistant.suggestion.drawerCash": "How much cash should be in the drawer?",
  "assistant.suggestion.expense": "Record 500 rupees electricity expense",
  "assistant.suggestion.payment": "Ali paid 200 on his khata",
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

  // Proposal cards
  "proposal.kind.sale": "sale",
  "proposal.kind.expense": "expense",
  "proposal.kind.payment": "payment",
  "proposal.kind.customer": "customer",
  "proposal.kind.product": "product",
  "proposal.kind.product_update": "product change",
  "proposal.kind.stock_adjustment": "stock adjustment",
  "proposal.notSaved": "Proposed {{kind}} — not saved yet",
  "proposal.expires": "Expires {{date}}",
  "proposal.nothingSaved":
    "Nothing has been saved. Press {{action}} to record it. The assistant cannot confirm it for you.",
  "proposal.confirmSale": "Confirm sale",
  "proposal.confirmExpense": "Confirm expense",
  "proposal.confirmPayment": "Confirm payment",
  "proposal.confirmCustomer": "Confirm customer",
  "proposal.confirmProduct": "Confirm product",
  "proposal.confirmChanges": "Confirm changes",
  "proposal.confirmAdjustment": "Confirm adjustment",
  "proposal.dismiss": "Dismiss",
  "proposal.paymentCredit": "Credit (khata)",
  "proposal.paymentCash": "Cash",
  "proposal.customer": "Customer",
  "proposal.category": "Category",
  "proposal.khataBefore": "Khata before",
  "proposal.khataAfter": "Khata after",
  "proposal.name": "Name",
  "proposal.phone": "Phone",
  "proposal.unit": "Unit",
  "proposal.costPrice": "Cost price",
  "proposal.salePrice": "Sale price",
  "proposal.openingStock": "Opening stock",
  "proposal.lowStockLevel": "Low-stock level",
  "proposal.barcode": "Barcode",
  "proposal.alsoCalled": "Also called",
  "proposal.stockBefore": "Stock before",
  "proposal.stockAfter": "Stock after",
  "proposal.reason": "Reason",
  "proposal.reason.RESTOCK": "Restock",
  "proposal.reason.DAMAGE": "Damage or loss",
  "proposal.reason.CORRECTION": "Stock correction",
  "proposal.reason.OTHER": "Other",
  "proposal.inStock": "in stock",
  "proposal.cashReceived": "Cash received",
  "proposal.change": "Change",
  "proposal.note": "Note",
  "proposal.saleRecorded": "Sale recorded.",
  "proposal.saleAlreadyRecorded": "This sale was already recorded.",
  "proposal.expenseRecorded": "Expense recorded.",
  "proposal.expenseAlreadyRecorded": "This expense was already recorded.",
  "proposal.paymentRecorded": "Payment recorded.",
  "proposal.paymentAlreadyRecorded": "This payment was already recorded.",
  "proposal.customerRecorded": "Customer recorded.",
  "proposal.customerAlreadyRecorded": "This customer was already created.",
  "proposal.productRecorded": "Product recorded.",
  "proposal.productAlreadyRecorded": "This product was already created.",
  "proposal.productChangesRecorded": "Product changes recorded.",
  "proposal.productChangesAlreadyRecorded": "These product changes were already applied.",
  "proposal.stockAdjustmentRecorded": "Stock adjustment recorded.",
  "proposal.stockAdjustmentAlreadyRecorded": "This stock adjustment was already applied.",
  "proposal.receipt": "View receipt",
  "proposal.expenses": "View expenses",
  "proposal.customerRecord": "View customer",
  "proposal.productRecord": "View product",
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
  "action.newSale": "فروخت کول",
  "action.search": "جستجو",
  "action.clearSearch": "پاک کړئ",
  "action.confirm": "تایید کړئ",
  "action.dismiss": "رد کړئ",
  "action.save": "ذخیره کړئ",
  "action.cancel": "منسوخ کړئ",
  "action.edit": "Edit",
  "action.view": "View",
  "action.back": "Back",

  // Common labels
  "label.customer": "مشتری",
  "label.total": "Total",
  "label.stock": "Stock",
  "label.date": "Date",
  "label.amount": "Amount",
  "label.note": "Note",

  // Assistant
  "assistant.checking": "د دکنی خبرې وکړئ…",
  "assistant.userLabel": "تاسو",
  "assistant.assistantLabel": "مددګر",
  "proposal.kind.sale": "فروخت",
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, ps };

/** Sync client-side lookup; falls back to English when a key is missing. */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string>,
): string {
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
