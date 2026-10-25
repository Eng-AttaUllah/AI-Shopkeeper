/**
 * Quantity helpers.
 *
 * Quantities are stored as integers in thousandths of the product's unit
 * (1.5 kg = 1500, 12 pieces = 12000). Integer arithmetic keeps stock exact and
 * makes the "stock never negative" invariant testable.
 *
 * See `docs/architecture.md`, invariants 1, 3, and 6.
 */

export const MILLI_PER_UNIT = 1000;

export const PRODUCT_UNITS = ["kg", "litre", "piece", "packet"] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

const UNIT_LABELS: Record<string, string> = {
  kg: "kg",
  litre: "L",
  piece: "pcs",
  packet: "pkt",
};

/** Raised when a value cannot be interpreted as a quantity. */
export class QuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantityError";
  }
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Convert a user-entered quantity into integer thousandths.
 * A fourth decimal place is rounded half-up: "1.2345" becomes 1235.
 */
export function toMilli(value: number | string): number {
  const raw = typeof value === "number" ? String(value) : value.trim();

  if (!DECIMAL_PATTERN.test(raw)) {
    throw new QuantityError(`"${raw}" is not a valid quantity.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const paddedFraction = `${fraction}0000`;

  let milli =
    Number(whole) * MILLI_PER_UNIT + Number(paddedFraction.slice(0, 3));

  if (Number(paddedFraction[3]) >= 5) {
    milli += 1;
  }

  const result = negative ? -milli : milli;

  assertIntegerMilli(result);

  return result;
}

/** Convert integer thousandths back to a decimal quantity. */
export function fromMilli(milli: number): number {
  assertIntegerMilli(milli);
  return milli / MILLI_PER_UNIT;
}

/** Guard used before any value is treated as a stored quantity. */
export function assertIntegerMilli(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new QuantityError(
      `Expected an integer number of thousandths, received ${value}.`,
    );
  }
}

/** Format a stored quantity for display, for example "1.5 kg" or "12 pcs". */
export function formatQuantity(milli: number, unit: string): string {
  assertIntegerMilli(milli);

  const value = fromMilli(milli);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);

  return `${formatted} ${UNIT_LABELS[unit] ?? unit}`;
}
