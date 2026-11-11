import { Prisma } from "@/generated/prisma/client";
import type { Customer, Payment, ShopMembership, User } from "@/generated/prisma/client";
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
  shopId: string,
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

      const customerCount = await tx.customer.count();

      const customer = await tx.customer.create({
        data: {
          name: data.name,
          phone: emptyToNull(data.phone),
          note: emptyToNull(data.note),
          shopId,
          customerId: `CST-${String(customerCount + 1).padStart(6, "0")}`,
          proposalId: options.proposalId ?? null,
        },
      });

      await writeAudit(tx, {
        actor,
        shopId,
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
  shopId: string,
  input: unknown,
): Promise<Result<Customer>> {
  const result = await createCustomerWithStatus(shopId, input);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.customer);
}

export async function updateCustomer(
  shopId: string,
  id: string,
  input: unknown,
): Promise<Result<Customer>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  try {
    const existing = await prisma.customer.findFirst({
      where: { id, shopId },
    });

    if (!existing) {
      return fail("Customer not found.");
    }

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
  shopId: string,
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

      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, shopId },
      });

      if (!customer) {
        throw new ServiceError("Customer not found.");
      }

      const outstanding = await outstandingPaisa(tx, shopId, data.customerId);

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
          shopId,
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
        shopId,
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
  shopId: string,
  input: unknown,
  actor: string = LOCAL_ACTOR,
): Promise<Result<Payment>> {
  const result = await recordPaymentWithStatus(shopId, input, actor);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.payment);
}

/** Create a customer user account (CUSTOMER account type) without any shop
 * link. Used for customer self-registration; the customer joins a shop later
 * and gets a ShopMembership at that point. The phone is used as the username.
 */
export async function createCustomerUser(
  input: unknown,
): Promise<Result<{ user: User }>> {
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

      const user = await tx.user.create({
        data: {
          username,
          name: data.name,
          passwordHash: await hash(data.password, BCRYPT_COST),
          accountType: "CUSTOMER",
        },
      });

      await writeAudit(tx, {
        actor: user.username,
        action: "CUSTOMER_ACCOUNT_CREATED",
        entityType: "User",
        entityId: user.id,
        summary: `Customer account created for ${user.name}`,
        before: null,
        after: {
          username: user.username,
          accountType: user.accountType,
        },
        details: {
          source: "self_registration",
        },
      });

      return { user };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/** Create a customer account (User with CUSTOMER account type) linked to an
 * existing Customer record via a ShopMembership. Used by the shopkeeper to
 * give an existing customer ledger record login access to their shop.
 * Creates both a User and a ShopMembership (role CUSTOMER, status ACTIVE)
 * linked to the Customer record, in one transaction.
 */
export async function createCustomerAccount(
  shopId: string,
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

      const found = await tx.customer.findFirst({
        where: { id: data.customerId, shopId },
      });

      if (!found) {
        throw new ServiceError("Customer not found.");
      }

      const linkedMembership = await tx.shopMembership.findFirst({
        where: { customerId: data.customerId },
      });

      if (linkedMembership) {
        throw new ServiceError("This customer already has an account.");
      }

      const customer = found;

      const user = await tx.user.create({
        data: {
          username,
          name: data.name,
          passwordHash: await hash(data.password, BCRYPT_COST),
          accountType: "CUSTOMER",
        },
      });

      await tx.shopMembership.create({
        data: {
          shopId,
          userId: user.id,
          role: "CUSTOMER",
          status: "ACTIVE",
          customerId: customer.id,
        },
      });

      await writeAudit(tx, {
        actor: user.username,
        shopId,
        action: "CUSTOMER_ACCOUNT_CREATED",
        entityType: "User",
        entityId: user.id,
        summary: `Customer account created for ${customer.name}`,
        before: null,
        after: {
          username: user.username,
          accountType: user.accountType,
        },
        details: {
          source: options.source ?? "shopkeeper",
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
  shopId: string,
  customerId: string,
  password: string,
): Promise<Result<{ customer: Customer; user: User }>> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId },
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
    shopId,
    {
      name: customer.name,
      phone: customer.phone,
      password,
      customerId: customer.id,
    },
    { source: "shopkeeper" },
  );
}

/**
 * Request to join a shop as a customer. Creates a PENDING ShopMembership that
 * the shopkeeper must approve before the customer can see the shop's khata.
 * Returns an error if the user is already a member or has a pending request.
 */
export async function createJoinRequest(
  shopId: string,
  userId: string,
): Promise<Result<{ membership: ShopMembership }>> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.shopMembership.findFirst({
        where: { shopId, userId },
      });

      if (existing) {
        throw new ServiceError(
          existing.status === "PENDING"
            ? "You have already requested to join this shop."
            : "You are already a member of this shop.",
        );
      }

      const shop = await tx.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new ServiceError("Shop not found.");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      if (!user) {
        throw new ServiceError("User not found.");
      }

      const membership = await tx.shopMembership.create({
        data: {
          shopId,
          userId,
          role: "CUSTOMER",
          status: "PENDING",
        },
      });

      await writeAudit(tx, {
        actor: user.username,
        shopId,
        action: "JOIN_REQUEST_CREATED",
        entityType: "ShopMembership",
        entityId: membership.id,
        summary: `Join request for "${shop.name}"`,
        before: null,
        after: {
          shopId,
          userId,
          role: membership.role,
          status: membership.status,
        },
      });

      return { membership };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * List pending join requests for a shop, newest first. Used by the shopkeeper
 * to review and approve/reject requests.
 */
export async function listJoinRequests(
  shopId: string,
): Promise<(ShopMembership & { user: User })[]> {
  return prisma.shopMembership.findMany({
    where: { shopId, status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Approve a join request. The shopkeeper may link the request to an existing
 * ledger Customer record (matched by phone) or create a new one. The
 * membership becomes ACTIVE with the ledger link.
 */
export async function approveJoinRequest(
  shopId: string,
  membershipId: string,
  options: {
    linkToCustomerId?: string;
    createCustomerName?: string;
    createCustomerPhone?: string | null;
    createCustomerNote?: string | null;
  },
): Promise<Result<{ membership: ShopMembership; customer: Customer }>> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const membership = await tx.shopMembership.findFirst({
        where: { id: membershipId, shopId, status: "PENDING" },
        include: { user: true },
      });

      if (!membership) {
        throw new ServiceError("Join request not found or already decided.");
      }

      let customer: Customer;

      if (options.linkToCustomerId) {
        const found = await tx.customer.findFirst({
          where: { id: options.linkToCustomerId, shopId },
        });

        if (!found) {
          throw new ServiceError("Customer not found.");
        }

        const alreadyLinked = await tx.shopMembership.findFirst({
          where: { customerId: found.id, status: "ACTIVE" },
        });

        if (alreadyLinked) {
          throw new ServiceError("This customer is already linked to an account.");
        }

        customer = found;
      } else if (options.createCustomerName) {
        const customerCount = await tx.customer.count({
          where: { shopId },
        });
        customer = await tx.customer.create({
          data: {
            name: options.createCustomerName,
            phone: options.createCustomerPhone ?? null,
            note: options.createCustomerNote ?? null,
            shopId,
            customerId: `CST-${String(customerCount + 1).padStart(6, "0")}`,
          },
        });
      } else {
        throw new ServiceError(
          "No customer record to link. Link an existing customer or create a new one.",
        );
      }

      const updated = await tx.shopMembership.update({
        where: { id: membershipId },
        data: { status: "ACTIVE", customerId: customer.id },
        include: { user: true },
      });

      await writeAudit(tx, {
        actor: membership.user.username,
        shopId,
        action: "JOIN_REQUEST_APPROVED",
        entityType: "ShopMembership",
        entityId: membership.id,
        summary: `Join request approved for shop "${shopId}"`,
        before: { status: "PENDING", customerId: null },
        after: { status: "ACTIVE", customerId: customer.id },
      });

      return { membership: updated, customer };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Reject a join request. The membership becomes REMOVED and the customer
 * sees nothing about the shop.
 */
export async function rejectJoinRequest(
  shopId: string,
  membershipId: string,
): Promise<Result<{ membership: ShopMembership }>> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const membership = await tx.shopMembership.findFirst({
        where: { id: membershipId, shopId, status: "PENDING" },
        include: { user: true },
      });

      if (!membership) {
        throw new ServiceError("Join request not found or already decided.");
      }

      const updated = await tx.shopMembership.update({
        where: { id: membershipId },
        data: { status: "REMOVED" },
        include: { user: true },
      });

      await writeAudit(tx, {
        actor: membership.user.username,
        shopId,
        action: "JOIN_REQUEST_REJECTED",
        entityType: "ShopMembership",
        entityId: membership.id,
        summary: `Join request rejected for shop "${shopId}"`,
        before: { status: "PENDING" },
        after: { status: "REMOVED" },
      });

      return { membership: updated };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Leave a shop as a customer. The membership becomes REMOVED and is audited.
 * The shop's ledger Customer record stays with the shop — leaving only ends
 * the login's access, not the shop's record of any khata the customer owes.
 * A customer may leave even while they owe money; the shop keeps the balance.
 * Only the membership's own owner may call this, only while ACTIVE.
 */
export async function leaveShop(
  userId: string,
  membershipId: string,
): Promise<Result<{ membership: ShopMembership }>> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const membership = await tx.shopMembership.findFirst({
        where: { id: membershipId, userId, role: "CUSTOMER", status: "ACTIVE" },
        include: { shop: true },
      });

      if (!membership) {
        throw new ServiceError(
          "Active customer membership not found for this shop.",
        );
      }

      const before = {
        role: membership.role,
        status: membership.status,
        customerId: membership.customerId,
      };

      let balancePaisa: number | undefined;
      if (membership.customerId) {
        balancePaisa = await outstandingPaisa(
          tx,
          membership.shopId,
          membership.customerId,
        );
      }

      const updated = await tx.shopMembership.update({
        where: { id: membershipId },
        data: { status: "REMOVED" },
      });

      await writeAudit(tx, {
        actor: membership.shop ? "local" : undefined,
        shopId: membership.shopId,
        action: "MEMBERSHIP_LEFT",
        entityType: "ShopMembership",
        entityId: membershipId,
        summary: `Customer left shop "${membership.shop?.name ?? membership.shopId}"`,
        before,
        after: { status: "REMOVED" },
        details: balancePaisa !== undefined
          ? { outstandingPaisa: balancePaisa }
          : undefined,
      });

      return { membership: updated };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Cancel a PENDING join request. The membership becomes REMOVED and is audited.
 * Only the request's own owner may call this, only while PENDING.
 */
export async function cancelJoinRequest(
  userId: string,
  membershipId: string,
): Promise<Result<{ membership: ShopMembership }>> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const membership = await tx.shopMembership.findFirst({
        where: { id: membershipId, userId, role: "CUSTOMER", status: "PENDING" },
        include: { shop: true },
      });

      if (!membership) {
        throw new ServiceError(
          "Pending join request not found for this account.",
        );
      }

      const before = { role: membership.role, status: membership.status };

      const updated = await tx.shopMembership.update({
        where: { id: membershipId },
        data: { status: "REMOVED" },
      });

      await writeAudit(tx, {
        actor: membership.shop ? "local" : undefined,
        shopId: membership.shopId,
        action: "JOIN_REQUEST_CANCELLED",
        entityType: "ShopMembership",
        entityId: membershipId,
        summary: `Join request cancelled for shop "${membership.shop?.name ?? membership.shopId}"`,
        before,
        after: { status: "REMOVED" },
      });

      return { membership: updated };
    });

    return ok(outcome);
  } catch (error) {
    return handleError(error);
  }
}
