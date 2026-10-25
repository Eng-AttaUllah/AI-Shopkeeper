import { describe, expect, it } from "vitest";

import { formatDate, formatPaisa } from "../src/lib/format";

describe("formatPaisa", () => {
  it("formats paisa with the rupee prefix and two decimals", () => {
    expect(formatPaisa(0)).toBe("Rs. 0.00");
    expect(formatPaisa(5)).toBe("Rs. 0.05");
    expect(formatPaisa(16050)).toBe("Rs. 160.50");
    expect(formatPaisa(123456789)).toBe("Rs. 1,234,567.89");
  });

  it("formats negative amounts", () => {
    expect(formatPaisa(-1234)).toBe("-Rs. 12.34");
  });
});

describe("formatDate", () => {
  it("renders dates in the shop timezone", () => {
    expect(formatDate(new Date("2026-10-25T20:00:00Z"))).toBe("26 Oct 2026");
    expect(formatDate(new Date("2026-10-25T10:00:00Z"))).toBe("25 Oct 2026");
  });
});
