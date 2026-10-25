import { describe, expect, it } from "vitest";

import {
  MoneyError,
  PAISA_PER_RUPEE,
  multiplyPaisa,
  paisaToRupees,
  rupeesToPaisa,
  sumPaisa,
} from "../src/lib/money";

describe("rupeesToPaisa", () => {
  it("converts whole rupees", () => {
    expect(rupeesToPaisa(160)).toBe(16000);
    expect(rupeesToPaisa("160")).toBe(16000);
    expect(rupeesToPaisa(0)).toBe(0);
  });

  it("converts rupees with paisa", () => {
    expect(rupeesToPaisa(160.5)).toBe(16050);
    expect(rupeesToPaisa("160.55")).toBe(16055);
    expect(rupeesToPaisa("0.05")).toBe(5);
  });

  it("avoids binary floating-point error", () => {
    expect(rupeesToPaisa("0.1") + rupeesToPaisa("0.2")).toBe(
      rupeesToPaisa("0.3"),
    );
  });

  it("rounds a third decimal place half-up", () => {
    expect(rupeesToPaisa("160.554")).toBe(16055);
    expect(rupeesToPaisa("160.555")).toBe(16056);
  });

  it("handles negative amounts", () => {
    expect(rupeesToPaisa("-12.34")).toBe(-1234);
  });

  it("rejects input that is not a plain decimal", () => {
    expect(() => rupeesToPaisa("")).toThrow(MoneyError);
    expect(() => rupeesToPaisa("abc")).toThrow(MoneyError);
    expect(() => rupeesToPaisa("1,000")).toThrow(MoneyError);
    expect(() => rupeesToPaisa("Rs. 100")).toThrow(MoneyError);
  });
});

describe("paisaToRupees", () => {
  it("converts paisa back to rupees", () => {
    expect(paisaToRupees(16050)).toBe(160.5);
    expect(paisaToRupees(0)).toBe(0);
  });

  it("rejects fractional paisa", () => {
    expect(() => paisaToRupees(10.5)).toThrow(MoneyError);
  });
});

describe("sumPaisa", () => {
  it("adds integer amounts exactly", () => {
    expect(sumPaisa([100, 250, 1])).toBe(351);
    expect(sumPaisa([])).toBe(0);
  });

  it("rejects a non-integer amount", () => {
    expect(() => sumPaisa([100, 0.5])).toThrow(MoneyError);
  });
});

describe("multiplyPaisa", () => {
  it("multiplies by whole quantities", () => {
    expect(multiplyPaisa(16000, 5)).toBe(80000);
  });

  it("rounds fractional quantities to the nearest paisa", () => {
    expect(multiplyPaisa(16050, 1.5)).toBe(24075);
    expect(multiplyPaisa(333, 1)).toBe(333);
  });

  it("rejects negative or non-finite quantities", () => {
    expect(() => multiplyPaisa(100, -1)).toThrow(MoneyError);
    expect(() => multiplyPaisa(100, Number.NaN)).toThrow(MoneyError);
  });
});

describe("PAISA_PER_RUPEE", () => {
  it("is 100", () => {
    expect(PAISA_PER_RUPEE).toBe(100);
  });
});
