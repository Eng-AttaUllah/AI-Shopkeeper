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

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
});

/** Format a day within a report, for example "26 Oct". */
export function formatDayMonth(value: Date): string {
  return DAY_MONTH_FORMATTER.format(value);
}

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  month: "long",
  year: "numeric",
});

/** Format a report month, for example "October 2026". */
export function formatMonthYear(value: Date): string {
  return MONTH_YEAR_FORMATTER.format(value);
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** Format a date and time in the shop's timezone, for example "26 Oct 2026, 3:42 pm". */
export function formatDateTime(value: Date): string {
  return DATE_TIME_FORMATTER.format(value);
}
