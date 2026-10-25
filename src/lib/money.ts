/**
 * Money helpers.
 *
 * Every monetary value in this project is an integer number of paisa
 * (1 PKR = 100 paisa). Floating point is never used to store, compare, or
 * total money. See `docs/architecture.md`, invariant 1.
 *
 * These functions are the only approved way to convert between rupees and
 * paisa. Do not use `parseFloat` on money anywhere else.
 */

export const PAISA_PER_RUPEE = 100;

/** Raised when a value cannot be interpreted as money. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Convert a rupee amount (as typed by a user) into integer paisa.
 *
 * Accepts strings to avoid binary floating-point surprises. A third decimal
 * place is rounded half-up, so "160.555" becomes 16056 paisa.
 *
 * @throws {MoneyError} when the input is not a plain decimal number.
 */
export function rupeesToPaisa(value: number | string): number {
  const raw = typeof value === "number" ? String(value) : value.trim();

  if (!DECIMAL_PATTERN.test(raw)) {
    throw new MoneyError(`"${raw}" is not a valid rupee amount.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const paddedFraction = `${fraction}000`;

  let paisa =
    Number(whole) * PAISA_PER_RUPEE + Number(paddedFraction.slice(0, 2));

  if (Number(paddedFraction[2]) >= 5) {
    paisa += 1;
  }

  const result = negative ? -paisa : paisa;

  assertIntegerPaisa(result);

  return result;
}

/** Convert integer paisa back to rupees for display or input prefill. */
export function paisaToRupees(paisa: number): number {
  assertIntegerPaisa(paisa);
  return paisa / PAISA_PER_RUPEE;
}

/** Guard used before any value is treated as money. */
export function assertIntegerPaisa(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `Expected an integer number of paisa, received ${value}.`,
    );
  }
}

/** Add a list of paisa amounts without floating-point error. */
export function sumPaisa(values: readonly number[]): number {
  let total = 0;

  for (const value of values) {
    assertIntegerPaisa(value);
    total += value;
  }

  assertIntegerPaisa(total);

  return total;
}

/**
 * Multiply a unit price by a quantity that may be fractional (for example
 * 1.5 kg). The result is rounded half-up to the nearest paisa, because a
 * fraction of a paisa cannot be represented.
 */
export function multiplyPaisa(unitPaisa: number, quantity: number): number {
  assertIntegerPaisa(unitPaisa);

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative number, received ${quantity}.`);
  }

  const total = Math.round(unitPaisa * quantity);

  assertIntegerPaisa(total);

  return total;
}
