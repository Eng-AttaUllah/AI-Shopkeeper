import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { verifyCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import {
  createAccountForCustomer,
  createCustomer,
  createCustomerAccount,
} from "@/modules/customers/service";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

let shopId: string;

beforeEach(async () => {
  const shop = await prisma.shop.create({
    data: { name: "Test Shop", currency: "PKR", timezone: "Asia/Karachi" },
  });
  shopId = shop.id;

  // Users reference customers, so remove users first.
  await prisma.user.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.customer.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("customer accounts", () => {
  it("self-registers a customer with a linked user account", async () => {
    const { customer, user } = expectOk(
      await createCustomerAccount(shopId, {
        name: "Ali Khan",
        phone: "0300 1234567",
        password: "secret-pass",
      }),
    );

    expect(customer.name).toBe("Ali Khan");
    expect(customer.phone).toBe("0300 1234567");
    expect(user.role).toBe("CUSTOMER");
    expect(user.username).toBe("03001234567");
    expect(user.customerId).toBe(customer.id);
    expect(user.passwordHash).not.toBe("secret-pass");
    expect(user.passwordHash.startsWith("$2")).toBe(true);

    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      include: { customer: true },
    });

    expect(stored?.customer?.id).toBe(customer.id);
  });

  it("signs in with the phone number and reports the CUSTOMER role", async () => {
    expectOk(
      await createCustomerAccount(shopId, {
        name: "Ali Khan",
        phone: "03001234567",
        password: "secret-pass",
      }),
    );

    const signedIn = await verifyCredentials({
      username: "03001234567",
      password: "secret-pass",
    });

    expect(signedIn?.role).toBe("CUSTOMER");
    expect(signedIn?.customerId).toBeTruthy();

    expect(
      await verifyCredentials({
        username: "03001234567",
        password: "wrong-password",
      }),
    ).toBeNull();
  });

  it("signs in with a differently formatted phone number", async () => {
    expectOk(
      await createCustomerAccount(shopId, {
        name: "Ali Khan",
        phone: "0300 1234567",
        password: "secret-pass",
      }),
    );

    const signedIn = await verifyCredentials({
      username: "0300-123-4567",
      password: "secret-pass",
    });

    expect(signedIn?.role).toBe("CUSTOMER");
  });

  it("rejects a phone number that is already registered", async () => {
    expectOk(
      await createCustomerAccount(shopId, {
        name: "Ali Khan",
        phone: "03001234567",
        password: "secret-pass",
      }),
    );

    const second = await createCustomerAccount(shopId, {
      name: "Second Person",
      phone: "0300 123-4567",
      password: "another-pass",
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.fieldErrors?.phone).toBeTruthy();
    }

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("links a new account to an existing customer record", async () => {
    const existing = expectOk(
      await createCustomer(shopId, {
        name: "Existing Customer",
        phone: "0311 1112223",
      }),
    );

    const { customer, user } = expectOk(
      await createCustomerAccount(shopId, {
        name: "Existing Customer",
        phone: "0311 1112223",
        password: "secret-pass",
        customerId: existing.id,
      }),
    );

    expect(customer.id).toBe(existing.id);
    expect(user.customerId).toBe(existing.id);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("lets the shopkeeper create an account for an existing customer", async () => {
    const existing = expectOk(
      await createCustomer(shopId, {
        name: "Bilal",
        phone: "0321 9876543",
      }),
    );

    const { customer, user } = expectOk(
      await createAccountForCustomer(shopId, existing.id, "shop-created-pass"),
    );

    expect(customer.id).toBe(existing.id);
    expect(user.role).toBe("CUSTOMER");
    expect(user.username).toBe("03219876543");
    expect(user.customerId).toBe(existing.id);
  });

  it("refuses to create an account when the customer has no phone", async () => {
    const existing = expectOk(
      await createCustomer(shopId, { name: "No Phone" }),
    );

    const result = await createAccountForCustomer(
      shopId,
      existing.id,
      "shop-created-pass",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.phone).toBeTruthy();
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses a second account for the same customer", async () => {
    const existing = expectOk(
      await createCustomer(shopId, {
        name: "Bilal",
        phone: "0321 9876543",
      }),
    );

    expectOk(await createAccountForCustomer(shopId, existing.id, "shop-created-pass"));

    const second = await createAccountForCustomer(
      shopId,
      existing.id,
      "another-pass-123",
    );

    expect(second.ok).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });

  it("rejects a password shorter than eight characters", async () => {
    const result = await createCustomerAccount(shopId, {
      name: "Ali Khan",
      phone: "03001234567",
      password: "short",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.customer.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });
});
