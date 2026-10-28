import { describe, expect, it } from "vitest";

import { karachiDateTime } from "@/lib/dates";
import type { Result } from "@/lib/result";
import { resolveAssistantRange } from "@/modules/assistant/range";
import { assistantRangeSchema } from "@/modules/assistant/schema";

const now = karachiDateTime(2026, 10, 28, 12, 0);

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

function expectFail<T>(result: Result<T>): string {
  if (result.ok) {
    throw new Error("Expected a failure");
  }

  return result.error;
}

describe("resolveAssistantRange", () => {
  it("defaults to today", () => {
    const resolved = expectOk(
      resolveAssistantRange(assistantRangeSchema.parse({}), now),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 10, 28).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 29).getTime(),
    );
    expect(resolved.label).toBe("Today, 28 Oct 2026");
    expect(resolved.fromKey).toBe("2026-10-28");
    expect(resolved.toKey).toBe("2026-10-28");
  });

  it("resolves yesterday as one shop day", () => {
    const resolved = expectOk(
      resolveAssistantRange({ range: "yesterday" }, now),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 10, 27).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 28).getTime(),
    );
    expect(resolved.label).toBe("Yesterday, 27 Oct 2026");
  });

  it("resolves this month to month-to-date", () => {
    const resolved = expectOk(
      resolveAssistantRange({ range: "this_month" }, now),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 10, 1).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 29).getTime(),
    );
    expect(resolved.label).toBe("October 2026");
  });

  it("resolves last month to the whole previous month", () => {
    const resolved = expectOk(
      resolveAssistantRange({ range: "last_month" }, now),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 9, 1).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 1).getTime(),
    );
    expect(resolved.label).toBe("September 2026");
    expect(resolved.fromKey).toBe("2026-09-01");
    expect(resolved.toKey).toBe("2026-09-30");
  });

  it("resolves this year to year-to-date", () => {
    const resolved = expectOk(
      resolveAssistantRange({ range: "this_year" }, now),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 1, 1).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 29).getTime(),
    );
    expect(resolved.label).toBe("2026");
  });

  it("resolves a custom range inclusively", () => {
    const resolved = expectOk(
      resolveAssistantRange(
        { range: "custom", from: "2026-10-01", to: "2026-10-05" },
        now,
      ),
    );

    expect(resolved.range.start.getTime()).toBe(
      karachiDateTime(2026, 10, 1).getTime(),
    );
    expect(resolved.range.end.getTime()).toBe(
      karachiDateTime(2026, 10, 6).getTime(),
    );
    expect(resolved.label).toBe("01 Oct 2026 – 05 Oct 2026");
  });

  it("labels a one-day custom range with one date", () => {
    const resolved = expectOk(
      resolveAssistantRange(
        { range: "custom", from: "2026-10-05", to: "2026-10-05" },
        now,
      ),
    );

    expect(resolved.label).toBe("05 Oct 2026");
  });

  it("rejects a custom range without both dates", () => {
    expect(
      expectFail(resolveAssistantRange({ range: "custom" }, now)),
    ).toContain("both from and to");
  });

  it("rejects impossible custom dates and an inverted range", () => {
    expect(
      expectFail(
        resolveAssistantRange(
          { range: "custom", from: "2026-02-31", to: "2026-03-01" },
          now,
        ),
      ),
    ).toContain("valid start date");

    expect(
      expectFail(
        resolveAssistantRange(
          { range: "custom", from: "2026-10-10", to: "2026-10-01" },
          now,
        ),
      ),
    ).toContain("on or before");
  });
});
