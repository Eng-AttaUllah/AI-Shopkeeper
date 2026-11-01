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
