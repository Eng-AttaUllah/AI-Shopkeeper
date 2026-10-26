import { describe, expect, it } from "vitest";

import {
  addKarachiDays,
  dateKeyInKarachi,
  eachKarachiDay,
  eachKarachiMonth,
  karachiDateKeyToDate,
  karachiDateTime,
  karachiDayRange,
  karachiMonthRange,
  karachiYearRange,
  startOfKarachiDay,
  startOfKarachiMonth,
  startOfKarachiYear,
} from "@/lib/dates";
import { formatDateTime } from "@/lib/format";

describe("dateKeyInKarachi", () => {
  it("uses the Karachi calendar day rather than UTC", () => {
    // 20:00 UTC is 01:00 the next day in Karachi.
    expect(dateKeyInKarachi(new Date("2026-10-25T20:00:00Z"))).toBe("20261026");
    expect(dateKeyInKarachi(new Date("2026-10-25T18:59:59Z"))).toBe("20261025");
  });
});

describe("Karachi ranges", () => {
  it("starts and ends the shop day at local midnight", () => {
    const range = karachiDayRange(new Date("2026-10-26T10:00:00Z"));

    expect(range.start.toISOString()).toBe("2026-10-25T19:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-26T19:00:00.000Z");
    expect(dateKeyInKarachi(range.start)).toBe("20261026");
  });

  it("splits the day at midnight, not at UTC midnight", () => {
    const before = karachiDayRange(new Date("2026-10-25T18:59:59Z"));
    const after = karachiDayRange(new Date("2026-10-25T19:00:00Z"));

    expect(dateKeyInKarachi(before.start)).toBe("20261025");
    expect(dateKeyInKarachi(after.start)).toBe("20261026");
  });

  it("builds whole month and year ranges in the shop timezone", () => {
    const month = karachiMonthRange(new Date("2026-10-15T10:00:00Z"));
    expect(month.start.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-10-31T19:00:00.000Z");

    const year = karachiYearRange(new Date("2026-10-15T10:00:00Z"));
    expect(year.start.toISOString()).toBe("2025-12-31T19:00:00.000Z");
    expect(year.end.toISOString()).toBe("2026-12-31T19:00:00.000Z");
  });

  it("starts days, months, and years at local midnight", () => {
    const instant = new Date("2026-10-26T10:00:00Z");

    expect(startOfKarachiDay(instant).toISOString()).toBe(
      "2026-10-25T19:00:00.000Z",
    );
    expect(startOfKarachiMonth(instant).toISOString()).toBe(
      "2026-09-30T19:00:00.000Z",
    );
    expect(startOfKarachiYear(instant).toISOString()).toBe(
      "2025-12-31T19:00:00.000Z",
    );
  });

  it("adds calendar days across month and year boundaries", () => {
    const start = karachiDateTime(2026, 12, 31);
    const next = addKarachiDays(start, 1);

    expect(next.toISOString()).toBe("2026-12-31T19:00:00.000Z");
    expect(dateKeyInKarachi(next)).toBe("20270101");
  });
});

describe("karachiDateKeyToDate", () => {
  it("parses a valid shop date to local midnight", () => {
    expect(karachiDateKeyToDate("2026-10-26")?.toISOString()).toBe(
      "2026-10-25T19:00:00.000Z",
    );
  });

  it("rejects impossible and malformed dates", () => {
    expect(karachiDateKeyToDate("2026-02-31")).toBeNull();
    expect(karachiDateKeyToDate("2026-13-01")).toBeNull();
    expect(karachiDateKeyToDate("26-10-2026")).toBeNull();
  });
});

describe("report bucket helpers", () => {
  it("lists every day touched by a range", () => {
    const range = {
      start: karachiDateTime(2026, 10, 1),
      end: karachiDateTime(2026, 10, 4),
    };

    expect(eachKarachiDay(range).map((day) => day.key)).toEqual([
      "20261001",
      "20261002",
      "20261003",
    ]);
  });

  it("lists every month touched by a range", () => {
    const range = {
      start: karachiDateTime(2026, 10, 15),
      end: karachiDateTime(2027, 1, 10),
    };

    expect(eachKarachiMonth(range).map((month) => month.key)).toEqual([
      "202610",
      "202611",
      "202612",
      "202701",
    ]);
  });
});

describe("formatDateTime", () => {
  it("renders the shop's local time", () => {
    expect(formatDateTime(new Date("2026-10-25T10:42:00Z"))).toBe(
      "25 Oct 2026, 03:42 pm",
    );
  });
});
