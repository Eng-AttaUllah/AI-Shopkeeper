import {
  addKarachiDays,
  isoDateKeyInKarachi,
  karachiDateKeyToDate,
  karachiDayRange,
  karachiParts,
  startOfKarachiMonth,
  startOfKarachiYear,
  type DateRange,
} from "@/lib/dates";
import { formatDate, formatMonthYear } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/result";

import type { AssistantRangeInput } from "./schema";

export type ResolvedAssistantRange = {
  range: DateRange;
  /** Human-readable period, for example "Today, 28 Oct 2026". */
  label: string;
  fromKey: string;
  toKey: string;
};

function monthStartKey(now: Date): string {
  const parts = karachiParts(now);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
}

/**
 * Turn a validated assistant range into a concrete half-open range in
 * Asia/Karachi. "This month" and "this year" are month-to-date and
 * year-to-date, matching the reports screens. Custom ranges are inclusive of
 * both chosen days.
 */
export function resolveAssistantRange(
  input: AssistantRangeInput,
  now = new Date(),
): Result<ResolvedAssistantRange> {
  const todayKey = isoDateKeyInKarachi(now);
  const todayRange = karachiDayRange(now);
  const parts = karachiParts(now);

  if (input.range === "custom") {
    if (!input.from || !input.to) {
      return fail("For a custom range, provide both from and to dates.");
    }

    const fromDate = karachiDateKeyToDate(input.from);
    const toDate = karachiDateKeyToDate(input.to);

    if (!fromDate) {
      return fail("Enter a valid start date.");
    }

    if (!toDate) {
      return fail("Enter a valid end date.");
    }

    if (fromDate > toDate) {
      return fail("The start date must be on or before the end date.");
    }

    return ok({
      range: { start: fromDate, end: addKarachiDays(toDate, 1) },
      fromKey: input.from,
      toKey: input.to,
      label:
        input.from === input.to
          ? formatDate(fromDate)
          : `${formatDate(fromDate)} – ${formatDate(toDate)}`,
    });
  }

  if (input.range === "yesterday") {
    const yesterday = addKarachiDays(now, -1);
    const yesterdayKey = isoDateKeyInKarachi(yesterday);

    return ok({
      range: karachiDayRange(yesterday),
      fromKey: yesterdayKey,
      toKey: yesterdayKey,
      label: `Yesterday, ${formatDate(yesterday)}`,
    });
  }

  if (input.range === "this_month") {
    return ok({
      range: { start: startOfKarachiMonth(now), end: todayRange.end },
      fromKey: monthStartKey(now),
      toKey: todayKey,
      label: formatMonthYear(now),
    });
  }

  if (input.range === "last_month") {
    const thisMonthStart = startOfKarachiMonth(now);
    const lastMonthStart = startOfKarachiMonth(
      addKarachiDays(thisMonthStart, -1),
    );
    const lastMonthEnd = thisMonthStart;
    const lastDay = addKarachiDays(thisMonthStart, -1);

    return ok({
      range: { start: lastMonthStart, end: lastMonthEnd },
      fromKey: isoDateKeyInKarachi(lastMonthStart),
      toKey: isoDateKeyInKarachi(lastDay),
      label: formatMonthYear(lastMonthStart),
    });
  }

  if (input.range === "this_year") {
    return ok({
      range: { start: startOfKarachiYear(now), end: todayRange.end },
      fromKey: `${parts.year}-01-01`,
      toKey: todayKey,
      label: String(parts.year),
    });
  }

  return ok({
    range: todayRange,
    fromKey: todayKey,
    toKey: todayKey,
    label: `Today, ${formatDate(now)}`,
  });
}
