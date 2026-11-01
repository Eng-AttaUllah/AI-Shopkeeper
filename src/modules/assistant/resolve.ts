/** Shared name/phone matching for assistant proposal tools. */

export type ProposalToolContext = {
  userId: string;
  now: Date;
};

export type CustomerCandidate = {
  id: string;
  name: string;
  phone: string | null;
};

export type ProductCandidate = {
  id: string;
  name: string;
  barcode: string | null;
  aliases: string[];
};

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Match a customer by exact name or phone first, then by a name/phone
 * substring. Returns every match so the tool can ask instead of guessing.
 */
export function matchCustomer<T extends CustomerCandidate>(
  customers: T[],
  term: string,
): T[] {
  const normalized = normalize(term);
  const digits = normalizePhone(term);

  const exact = customers.filter(
    (customer) =>
      normalize(customer.name) === normalized ||
      (customer.phone !== null &&
        digits.length >= 3 &&
        normalizePhone(customer.phone) === digits),
  );

  if (exact.length > 0) {
    return exact;
  }

  return customers.filter(
    (customer) =>
      normalize(customer.name).includes(normalized) ||
      (customer.phone !== null &&
        digits.length >= 3 &&
        normalizePhone(customer.phone).includes(digits)),
  );
}

/**
 * Match a product by exact name, alias, or barcode first, then by a name or
 * alias substring. Returns every match so the tool can ask instead of guessing.
 */
export function matchProduct<T extends ProductCandidate>(
  products: T[],
  term: string,
): T[] {
  const normalized = normalize(term);
  const digits = normalizePhone(term);

  const exact = products.filter(
    (product) =>
      normalize(product.name) === normalized ||
      product.aliases.some((alias) => normalize(alias) === normalized) ||
      (product.barcode !== null && product.barcode === term.trim()),
  );

  if (exact.length > 0) {
    return exact;
  }

  if (digits.length >= 3) {
    const byBarcode = products.filter(
      (product) =>
        product.barcode !== null &&
        normalizePhone(product.barcode) === digits,
    );

    if (byBarcode.length > 0) {
      return byBarcode;
    }
  }

  return products.filter(
    (product) =>
      normalize(product.name).includes(normalized) ||
      product.aliases.some((alias) => normalize(alias).includes(normalized)),
  );
}

/** A short list of product names for a "which one?" reply. */
export function productCandidates(matches: ProductCandidate[]): string {
  return matches
    .slice(0, 5)
    .map((product) => product.name)
    .join(", ");
}
