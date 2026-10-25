import { Prisma } from "@/generated/prisma/client";
import type { Customer, Payment } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { outstandingPaisa } from "./balance";
import { customerSchema, paymentSchema } from "./schema";

/** An error whose message is safe and useful to show the shopkeeper. */
class ServiceError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function handleError(error: unknown): Result<never> {
  if (error instanceof ServiceError) {
    return fail(error.message, error.fieldErrors);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return fail("Customer not found.");
  }

  console.error("Customer service error:", error);
  return fail("Something went wrong while saving. Please try again.");
}

export async function createCustomer(
  input: unknown,
): Promise<Result<Customer>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  try {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: emptyToNull(data.phone),
        note: emptyToNull(data.note),
      },
    });

    return ok(customer);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateCustomer(
  id: string,
  input: unknown,
): Promise<Result<Customer>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: emptyToNull(data.phone),
        note: emptyToNull(data.note),
      },
    });

    return ok(customer);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Record a repayment against a customer's khata.
 *
 * Reads the outstanding balance inside the transaction and refuses to take it
 * below zero, so a customer can never end up owed money by the shop.
 */
export async function recordPayment(
  input: unknown,
): Promise<Result<Payment>> {
  const parsed = paymentSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const amountPaisa = rupeesToPaisa(data.amount);

  if (amountPaisa <= 0) {
    return fail("Enter an amount more than zero.", {
      amount: "Must be more than zero",
    });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
      });

      if (!customer) {
        throw new ServiceError("Customer not found.");
      }

      const outstanding = await outstandingPaisa(tx, data.customerId);

      if (outstanding <= 0) {
        throw new ServiceError("This customer has no outstanding balance.");
      }

      if (amountPaisa > outstanding) {
        throw new ServiceError(
          `Only ${formatPaisa(outstanding)} is outstanding.`,
          { amount: "More than outstanding" },
        );
      }

      return tx.payment.create({
        data: {
          customerId: data.customerId,
          amountPaisa,
          note: emptyToNull(data.note),
        },
      });
    });

    return ok(payment);
  } catch (error) {
    return handleError(error);
  }
}
