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

const ZONED_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: KARACHI_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** A half-open time range: `start` is included, `end` is excluded. */
export type DateRange = {
  start: Date;
  end: Date;
};

export type KarachiParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * A stable YYYYMMDD key for the shop's calendar day. Used to build sale
 * numbers that restart each day, and to group report rows by day.
 */
export function dateKeyInKarachi(date: Date): string {
  const parts = DATE_KEY_FORMATTER.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}${value("month")}${value("day")}`;
}

/** The shop's calendar day as `YYYY-MM-DD`, for date inputs and range keys. */
export function isoDateKeyInKarachi(date: Date): string {
  const key = dateKeyInKarachi(date);

  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

/** The wall-clock parts of an instant in the shop's timezone. */
export function karachiParts(date: Date): KarachiParts {
  const parts = ZONED_PARTS_FORMATTER.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/**
 * How far the shop's local clock is ahead of UTC at a given instant. The
 * offset is read from Intl rather than hardcoded, so a future daylight-saving
 * change cannot silently shift report boundaries.
 */
function offsetMilliseconds(date: Date): number {
  const parts = karachiParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant for a wall-clock date and time in the shop's timezone.
 * Out-of-range days and months are normalised by `Date.UTC` (for example
 * month 13 becomes January of the next year).
 */
export function karachiDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const naive = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );

  let result = new Date(naive);

  // Two passes settle the offset even if the zone ever observes DST.
  for (let pass = 0; pass < 2; pass += 1) {
    result = new Date(naive - offsetMilliseconds(result));
  }

  return result;
}

/** Midnight at the start of the shop's day containing `date`. */
export function startOfKarachiDay(date: Date): Date {
  const parts = karachiParts(date);

  return karachiDateTime(parts.year, parts.month, parts.day);
}

/** Midnight on the first day of the shop's month containing `date`. */
export function startOfKarachiMonth(date: Date): Date {
  const parts = karachiParts(date);

  return karachiDateTime(parts.year, parts.month, 1);
}

/** Midnight on 1 January of the shop's year containing `date`. */
export function startOfKarachiYear(date: Date): Date {
  const parts = karachiParts(date);

  return karachiDateTime(parts.year, 1, 1);
}

/** Move by whole calendar days in the shop's timezone, keeping the time of day. */
export function addKarachiDays(date: Date, days: number): Date {
  const parts = karachiParts(date);

  return karachiDateTime(
    parts.year,
    parts.month,
    parts.day + days,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** The shop's day containing `date`, as a half-open UTC range. */
export function karachiDayRange(date: Date): DateRange {
  const parts = karachiParts(date);

  return {
    start: karachiDateTime(parts.year, parts.month, parts.day),
    end: karachiDateTime(parts.year, parts.month, parts.day + 1),
  };
}

/** The whole shop month containing `date`, as a half-open UTC range. */
export function karachiMonthRange(date: Date): DateRange {
  const parts = karachiParts(date);

  return {
    start: karachiDateTime(parts.year, parts.month, 1),
    end: karachiDateTime(parts.year, parts.month + 1, 1),
  };
}

/** The whole shop year containing `date`, as a half-open UTC range. */
export function karachiYearRange(date: Date): DateRange {
  const parts = karachiParts(date);

  return {
    start: karachiDateTime(parts.year, 1, 1),
    end: karachiDateTime(parts.year + 1, 1, 1),
  };
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a `YYYY-MM-DD` shop-local date into the UTC instant of its midnight.
 * Returns null for malformed keys and for impossible dates such as 31 February.
 */
export function karachiDateKeyToDate(key: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(key);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;

  if (!yearText || !monthText || !dayText) {
    return null;
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = karachiDateTime(year, month, day);
  const parts = karachiParts(date);

  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    return null;
  }

  return date;
}

/** One bucket in a daily report series. */
export type KarachiDay = {
  key: string;
  date: Date;
};

/** Every shop-local day touched by a range, in order. */
export function eachKarachiDay(range: DateRange): KarachiDay[] {
  const days: KarachiDay[] = [];
  let cursor = startOfKarachiDay(range.start);

  while (cursor < range.end) {
    days.push({ key: dateKeyInKarachi(cursor), date: cursor });
    cursor = addKarachiDays(cursor, 1);
  }

  return days;
}

/** One bucket in a monthly report series. */
export type KarachiMonth = {
  key: string;
  date: Date;
};

/** Every shop-local month touched by a range, in order. */
export function eachKarachiMonth(range: DateRange): KarachiMonth[] {
  const months: KarachiMonth[] = [];
  let cursor = startOfKarachiMonth(range.start);

  while (cursor < range.end) {
    months.push({ key: dateKeyInKarachi(cursor).slice(0, 6), date: cursor });
    const parts = karachiParts(cursor);
    cursor = karachiDateTime(parts.year, parts.month + 1, 1);
  }

  return months;
}
