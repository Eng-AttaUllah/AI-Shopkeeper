import { Prisma } from "@/generated/prisma/client";
import type { Customer, Payment, User } from "@/generated/prisma/client";
import { LOCAL_ACTOR, writeAudit } from "@/lib/audit";
import {
  BCRYPT_COST,
  customerRegistrationSchema,
  hash,
} from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { formatPaisa } from "@/lib/format";
import { rupeesToPaisa } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { normalizePhone } from "@/lib/text";
import { fieldErrors } from "@/lib/zod";

import { outstandingPaisa } from "./balance";
import {
  matchesCustomerPreview,
  matchesPaymentPreview,
  type CustomerPreview,
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

export type CreateCustomerOptions = {
  /** Set only when confirming an assistant proposal. */
  proposalId?: string;
  /** The preview the shopkeeper confirmed; the write must match it. */
  expectedPreview?: CustomerPreview;
};

export type CreateCustomerOutcome = {
  customer: Customer;
  alreadyConfirmed: boolean;
};

/**
 * Create a customer, optionally from a signed assistant proposal.
 *
 * The unique proposal id makes a replayed confirmation idempotent. Customer
 * creation does not touch money or stock, but the audit row still records who
 * created it and whether it came from the assistant.
 */
export async function createCustomerWithStatus(
  input: unknown,
  actor: string = LOCAL_ACTOR,
  options: CreateCustomerOptions = {},
): Promise<Result<CreateCustomerOutcome>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  if (
    options.expectedPreview &&
    !matchesCustomerPreview(data, options.expectedPreview)
  ) {
    return fail(
      "This customer proposal changed before it was confirmed. Ask the assistant to prepare it again.",
    );
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (options.proposalId) {
        const existing = await tx.customer.findUnique({
          where: { proposalId: options.proposalId },
        });

        if (existing) {
          return { customer: existing, alreadyConfirmed: true };
        }
      }

      const customer = await tx.customer.create({
        data: {
          name: data.name,
          phone: emptyToNull(data.phone),
          note: emptyToNull(data.note),
          proposalId: options.proposalId ?? null,
        },
      });

      await writeAudit(tx, {
        actor,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: customer.id,
        summary: `Customer ${customer.name} created`,
        before: null,
        after: {
          name: customer.name,
          phone: customer.phone,
          note: customer.note,
        },
        details: {
          proposalId: customer.proposalId,
          source: options.proposalId
            ? "assistant_proposal"
            : "customer_screen",
        },
        proposalId: options.proposalId,
      });

      return { customer, alreadyConfirmed: false };
    });

    return ok(outcome);
  } catch (error) {
    // A concurrent confirmation may win the unique proposal index.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      options.proposalId
    ) {
      const existing = await prisma.customer.findUnique({
        where: { proposalId: options.proposalId },
      });

      if (existing) {
        return ok({ customer: existing, alreadyConfirmed: true });
      }
    }

    return handleError(error);
  }
}

export async function createCustomer(
  input: unknown,
): Promise<Result<Customer>> {
  const result = await createCustomerWithStatus(input);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.customer);
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

/** Create a customer account (User with CUSTOMER role) linked to a Customer record.
 *
 * Used for customer self-registration and for accounts created by the
 * shopkeeper. Creates both a User and, if no customerId is given, a Customer
 * record in one transaction. The phone is used as the username.
 */
export async function createCustomerAccount(
  input: unknown,
  options: { source?: "self_registration" | "shopkeeper" } = {},
): Promise<Result<{ customer: Customer; user: User }>> {
  const parsed = customerRegistrationSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  // The phone doubles as the login name; store it without spaces or dashes so
  // sign-in works however the customer types it.
  const username = normalizePhone(data.phone);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Check if phone is already used as a username.
      const existingUser = await tx.user.findUnique({
        where: { username },
      });

      if (existingUser) {
        throw new ServiceError(
          "An account with this phone number already exists.",
          { phone: "Already registered" },
        );
      }

      let customer: Customer;

      if (data.customerId) {
        const found = await tx.customer.findUnique({
          where: { id: data.customerId },
        });

        if (!found) {
          throw new ServiceError("Customer not found.");
        }

        const linkedUser = await tx.user.findUnique({
          where: { customerId: data.customerId },
        });

        if (linkedUser) {
          throw new ServiceError("This customer already has an account.");
        }

        customer = found;
      } else {
        customer = await tx.customer.create({
          data: {
            name: data.name,
            phone: data.phone,
            note: null,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          username,
          name: data.name,
          passwordHash: await hash(data.password, BCRYPT_COST),
          role: "CUSTOMER",
          customerId: customer.id,
        },
      });

      await writeAudit(tx, {
        actor: user.username,
        action: "CUSTOMER_ACCOUNT_CREATED",
        entityType: "User",
        entityId: user.id,
        summary: `Customer account created for ${customer.name}`,
        before: null,
        after: {
          username: user.username,
          role: user.role,
          customerId: user.customerId,
        },
        details: {
          source: options.source ?? "self_registration",
        },
      });

      return { customer, user };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Shopkeeper-side helper: create an account for an existing customer using the
 * customer's phone number as the login name. A phone number is required because
 * it doubles as the username.
 */
export async function createAccountForCustomer(
  customerId: string,
  password: string,
): Promise<Result<{ customer: Customer; user: User }>> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return fail("Customer not found.");
  }

  if (!customer.phone) {
    return fail(
      "Add a phone number to this customer before creating an account.",
      { phone: "A phone number is required for sign-in." },
    );
  }

  return createCustomerAccount(
    {
      name: customer.name,
      phone: customer.phone,
      password,
      customerId: customer.id,
    },
    { source: "shopkeeper" },
  );
}
