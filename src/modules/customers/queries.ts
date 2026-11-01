import type { Customer } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatDate, formatPaisa } from "@/lib/format";
import { normalizeDigits, normalizeText } from "@/lib/text";

import { outstandingPaisa } from "./balance";

export type CustomerWithBalance = Customer & { balancePaisa: number };

export type CustomerHistoryEntry =
  | {
      kind: "sale";
      id: string;
      number: string;
      createdAt: Date;
      totalPaisa: number;
      paidPaisa: number;
      duePaisa: number;
      itemCount: number;
    }
  | {
      kind: "payment";
      id: string;
      createdAt: Date;
      amountPaisa: number;
      note: string | null;
    };

export type CustomerOption = {
  id: string;
  name: string;
  balancePaisa: number;
};

/** Customers with their derived khata balance, searched by name or phone. */
export async function listCustomersWithBalances(
  search?: string,
): Promise<CustomerWithBalance[]> {
  const term = search?.trim();

  let customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  if (term) {
    const normalized = normalizeText(term);
    const digits = normalizeDigits(term).replace(/\D/g, "");

    customers = customers.filter((customer) => {
      const nameMatch = normalizeText(customer.name).includes(normalized);
      const phone = customer.phone ?? "";
      const phoneMatch = normalizeDigits(phone).replace(/\D/g, "").includes(digits);
      return nameMatch || (digits.length >= 3 && phoneMatch);
    });
  }

  if (customers.length === 0) {
    return [];
  }

  const ids = customers.map((customer) => customer.id);

  const sales = await prisma.sale.findMany({
    where: {
      customerId: { in: ids },
      paymentMethod: "CREDIT",
      voidedAt: null,
    },
    select: { customerId: true, totalPaisa: true, paidPaisa: true },
  });

  const payments = await prisma.payment.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids } },
    _sum: { amountPaisa: true },
  });

  const dueByCustomer = new Map<string, number>();

  for (const sale of sales) {
    if (!sale.customerId) {
      continue;
    }

    dueByCustomer.set(
      sale.customerId,
      (dueByCustomer.get(sale.customerId) ?? 0) +
        sale.totalPaisa -
        sale.paidPaisa,
    );
  }

  const paidByCustomer = new Map(
    payments.map((row) => [row.customerId, row._sum.amountPaisa ?? 0]),
  );

  return customers.map((customer) => ({
    ...customer,
    balancePaisa:
      (dueByCustomer.get(customer.id) ?? 0) -
      (paidByCustomer.get(customer.id) ?? 0),
  }));
}

/** Compact customer list for the credit choice on the sell screen. */
export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const customers = await listCustomersWithBalances();

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    balancePaisa: customer.balancePaisa,
  }));
}

/** Total owed by every customer, used by the customers summary. */
export async function totalOutstandingPaisa(): Promise<number> {
  const sales = await prisma.sale.findMany({
    where: { paymentMethod: "CREDIT", voidedAt: null },
    select: { totalPaisa: true, paidPaisa: true },
  });

  const payments = await prisma.payment.aggregate({
    _sum: { amountPaisa: true },
  });

  const duePaisa = sales.reduce(
    (total, sale) => total + sale.totalPaisa - sale.paidPaisa,
    0,
  );

  return duePaisa - (payments._sum.amountPaisa ?? 0);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}

export async function customerBalancePaisa(id: string): Promise<number> {
  return outstandingPaisa(prisma, id);
}

/** Credit sales and repayments for one customer, newest first. */
export async function customerHistory(
  customerId: string,
  take = 50,
): Promise<CustomerHistoryEntry[]> {
  const sales = await prisma.sale.findMany({
    where: { customerId, paymentMethod: "CREDIT", voidedAt: null },
    select: {
      id: true,
      number: true,
      createdAt: true,
      totalPaisa: true,
      paidPaisa: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const payments = await prisma.payment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take,
  });

  const entries: CustomerHistoryEntry[] = [
    ...sales.map((sale) => ({
      kind: "sale" as const,
      id: sale.id,
      number: sale.number,
      createdAt: sale.createdAt,
      totalPaisa: sale.totalPaisa,
      paidPaisa: sale.paidPaisa,
      duePaisa: sale.totalPaisa - sale.paidPaisa,
      itemCount: sale._count.items,
    })),
    ...payments.map((payment) => ({
      kind: "payment" as const,
      id: payment.id,
      createdAt: payment.createdAt,
      amountPaisa: payment.amountPaisa,
      note: payment.note,
    })),
  ];

  return entries
    .sort((a, b) => {
      const difference = b.createdAt.getTime() - a.createdAt.getTime();

      if (difference !== 0) {
        return difference;
      }

      // SQLite timestamps have second precision, so a repayment recorded in the
      // same second as a sale should still appear above it.
      if (a.kind === b.kind) {
        return 0;
      }

      return a.kind === "payment" ? -1 : 1;
    })
    .slice(0, take);
}

type StatementInput = {
  shopName: string;
  customer: Pick<Customer, "name" | "phone">;
  balancePaisa: number;
  entries: CustomerHistoryEntry[];
  now?: Date;
};

/** WhatsApp-ready statement of what a customer owes. */
export function buildStatementText(input: StatementInput): string {
  const lines = [
    `${input.shopName} — Khata`,
    `Customer: ${input.customer.name}`,
  ];

  if (input.customer.phone) {
    lines.push(`Phone: ${input.customer.phone}`);
  }

  lines.push("", `Outstanding: ${formatPaisa(input.balancePaisa)}`);

  const recent = input.entries.slice(0, 5);

  if (recent.length > 0) {
    lines.push("", "Recent:");

    for (const entry of recent) {
      if (entry.kind === "sale") {
        lines.push(
          `${formatDate(entry.createdAt)} · Sale ${entry.number} · ${formatPaisa(entry.duePaisa)} on credit`,
        );
      } else {
        lines.push(
          `${formatDate(entry.createdAt)} · Payment · ${formatPaisa(entry.amountPaisa)}`,
        );
      }
    }
  }

  lines.push("", `As of ${formatDate(input.now ?? new Date())}.`);

  return lines.join("\n");
}
