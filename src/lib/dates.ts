/**
 * Timezone helpers.
 *
 * Timestamps are stored in UTC and reported in the shop's timezone. Day,
 * month, and year boundaries are computed in Asia/Karachi. See
 * docs/architecture.md, invariant 10.
 */

export const KARACHI_TIME_ZONE = "Asia/Karachi";

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KARACHI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * A stable YYYYMMDD key for the shop's calendar day. Used to build sale
 * numbers that restart each day.
 */
export function dateKeyInKarachi(date: Date): string {
  const parts = DATE_KEY_FORMATTER.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}${value("month")}${value("day")}`;
}
