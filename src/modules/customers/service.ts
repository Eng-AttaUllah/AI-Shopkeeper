import { Prisma } from "@/generated/prisma/client";
import type { Customer, Payment } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { outstandingPaisa } from "./balance";
import {
  matchesPaymentPreview,
  type PaymentPreview,
} from "./preview";
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

export type RecordPaymentOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: PaymentPreview;
};

export type RecordPaymentOutcome = {
  payment: Payment;
  customerName: string;
  alreadyConfirmed: boolean;
};

/**
 * Record a repayment against a customer's khata.
 *
 * Reads the outstanding balance inside the transaction and refuses to take it
 * below zero, so a customer can never end up owed money by the shop.
 *
 * `recordPaymentWithStatus` also reports whether an assistant proposal was
 * already confirmed, so a replayed confirmation cannot credit the khata twice.
 * `recordPayment` keeps the simple customer-screen contract.
 */
export async function recordPaymentWithStatus(
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: RecordPaymentOptions = {},
): Promise<Result<RecordPaymentOutcome>> {
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
    const outcome = await prisma.$transaction(async (tx) => {
      // A replayed confirmation returns the payment that already exists. This
      // check must come before the balance check so a later repayment does not
      // make the original confirmation look stale.
      if (options.proposalId) {
        const existing = await tx.payment.findUnique({
          where: { proposalId: options.proposalId },
          include: { customer: { select: { name: true } } },
        });

        if (existing) {
          return {
            payment: existing,
            customerName: existing.customer.name,
            alreadyConfirmed: true,
          };
        }
      }

      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
      });

      if (!customer) {
        throw new ServiceError("Customer not found.");
      }

      const outstanding = await outstandingPaisa(tx, data.customerId);

      if (
        options.expectedPreview &&
        !matchesPaymentPreview(data, outstanding, options.expectedPreview)
      ) {
        throw new ServiceError(
          "The khata balance changed since this proposal was prepared. Ask the assistant to prepare it again.",
        );
      }

      if (outstanding <= 0) {
        throw new ServiceError("This customer has no outstanding balance.");
      }

      if (amountPaisa > outstanding) {
        throw new ServiceError(
          `Only ${formatPaisa(outstanding)} is outstanding.`,
          { amount: "More than outstanding" },
        );
      }

      const payment = await tx.payment.create({
        data: {
          customerId: data.customerId,
          amountPaisa,
          note: emptyToNull(data.note),
          proposalId: options.proposalId ?? null,
        },
      });

      const balanceAfterPaisa = outstanding - amountPaisa;

      if (
        options.expectedPreview &&
        options.expectedPreview.balanceAfterPaisa !== balanceAfterPaisa
      ) {
        throw new ServiceError(
          "The khata balance changed since this proposal was prepared. Ask the assistant to prepare it again.",
        );
      }

      await writeAudit(tx, {
        actor,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        summary: `Repayment ${formatPaisa(amountPaisa)} from ${customer.name}`,
        before: { balancePaisa: outstanding },
        after: { balancePaisa: balanceAfterPaisa },
        details: {
          customerId: data.customerId,
          amountPaisa,
          note: emptyToNull(data.note),
          proposalId: payment.proposalId,
          source: options.proposalId
            ? "assistant_proposal"
            : "customer_screen",
        },
      });

      return {
        payment,
        customerName: customer.name,
        alreadyConfirmed: false,
      };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existing = await prisma.payment.findUnique({
        where: { proposalId: options.proposalId },
        include: { customer: { select: { name: true } } },
      });

      if (existing) {
        return ok({
          payment: existing,
          customerName: existing.customer.name,
          alreadyConfirmed: true,
        });
      }
    }

    return handleError(error);
  }
}

/** Record a repayment from the customer screen. */
export async function recordPayment(
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Payment>> {
  const result = await recordPaymentWithStatus(input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.payment);
}
