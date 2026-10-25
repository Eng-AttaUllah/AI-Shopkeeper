import { describe, expect, it } from "vitest";

import {
  QuantityError,
  formatQuantity,
  fromMilli,
  toMilli,
} from "../src/lib/quantity";

describe("toMilli", () => {
  it("converts whole units", () => {
    expect(toMilli(2)).toBe(2000);
    expect(toMilli("12")).toBe(12000);
    expect(toMilli(0)).toBe(0);
  });

  it("converts fractional units", () => {
    expect(toMilli("1.5")).toBe(1500);
    expect(toMilli("0.001")).toBe(1);
    expect(toMilli("10.25")).toBe(10250);
  });

  it("rounds a fourth decimal place half-up", () => {
    expect(toMilli("1.2344")).toBe(1234);
    expect(toMilli("1.2345")).toBe(1235);
  });

  it("handles negative values", () => {
    expect(toMilli("-1.5")).toBe(-1500);
  });

  it("rejects input that is not a plain decimal", () => {
    expect(() => toMilli("")).toThrow(QuantityError);
    expect(() => toMilli("two")).toThrow(QuantityError);
    expect(() => toMilli("1,5")).toThrow(QuantityError);
  });
});

describe("fromMilli", () => {
  it("converts back to a decimal quantity", () => {
    expect(fromMilli(1500)).toBe(1.5);
    expect(fromMilli(0)).toBe(0);
  });

  it("rejects fractional thousandths", () => {
    expect(() => fromMilli(1.5)).toThrow(QuantityError);
  });
});

describe("formatQuantity", () => {
  it("formats with a readable unit label", () => {
    expect(formatQuantity(1500, "kg")).toBe("1.5 kg");
    expect(formatQuantity(2000, "piece")).toBe("2 pcs");
    expect(formatQuantity(1000, "litre")).toBe("1 L");
    expect(formatQuantity(0, "kg")).toBe("0 kg");
    expect(formatQuantity(1234, "kg")).toBe("1.234 kg");
  });
});
