import { describe, expect, it } from "vitest";

import { dateKeyInKarachi } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";

describe("dateKeyInKarachi", () => {
  it("uses the Karachi calendar day rather than UTC", () => {
    // 20:00 UTC is 01:00 the next day in Karachi.
    expect(dateKeyInKarachi(new Date("2026-10-25T20:00:00Z"))).toBe("20261026");
    expect(dateKeyInKarachi(new Date("2026-10-25T18:59:59Z"))).toBe("20261025");
  });
});

describe("formatDateTime", () => {
  it("renders the shop's local time", () => {
    expect(formatDateTime(new Date("2026-10-25T10:42:00Z"))).toBe(
      "25 Oct 2026, 03:42 pm",
    );
  });
});
