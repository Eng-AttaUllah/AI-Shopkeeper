import { PAISA_PER_RUPEE, assertIntegerPaisa } from "./money";

/**
 * Display formatting. Every amount shown in the UI passes through here so
 * currency and dates look identical everywhere. See `docs/ui-context.md`.
 */

/** Format integer paisa as "Rs. 1,250.00". */
export function formatPaisa(paisa: number): string {
  assertIntegerPaisa(paisa);

  const negative = paisa < 0;
  const absolute = Math.abs(paisa);
  const rupees = Math.floor(absolute / PAISA_PER_RUPEE).toLocaleString("en-US");
  const fraction = String(absolute % PAISA_PER_RUPEE).padStart(2, "0");

  return `${negative ? "-" : ""}Rs. ${rupees}.${fraction}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Format a date in the shop's timezone, for example "26 Oct 2026". */
export function formatDate(value: Date): string {
  return DATE_FORMATTER.format(value);
}
