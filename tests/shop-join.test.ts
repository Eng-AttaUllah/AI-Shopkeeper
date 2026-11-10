import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hash } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createJoinRequest } from "@/modules/customers/service";
import { approveJoinRequest } from "@/modules/customers/service";
import { rejectJoinRequest } from "@/modules/customers/service";
import { listShopsWithMembership } from "@/modules/customers/queries";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

let shopId: string;
let userId: string;

beforeEach(async () => {
  await prisma.shopMembership.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  const shopCount = await prisma.shop.count();
  const shop = await prisma.shop.create({
    data: {
      name: "Test Shop",
      currency: "PKR",
      timezone: "Asia/Karachi",
      shopId: `SP-${String(shopCount + 1).padStart(6, "0")}`,
    },
  });
  shopId = shop.id;

  const user = await prisma.user.create({
    data: {
      username: "03001234567",
      name: "Test Customer",
      passwordHash: await hash("password", 12),
      accountType: "CUSTOMER",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createJoinRequest", () => {
  it("creates a PENDING membership", async () => {
    const result = expectOk(await createJoinRequest(shopId, userId));

    expect(result.membership.shopId).toBe(shopId);
    expect(result.membership.userId).toBe(userId);
    expect(result.membership.role).toBe("CUSTOMER");
    expect(result.membership.status).toBe("PENDING");
  });

  it("rejects a request when already a member", async () => {
    await expectOk(await createJoinRequest(shopId, userId));

    const result = await createJoinRequest(shopId, userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("You have already requested to join this shop.");
    }
  });

  it("rejects a duplicate pending request", async () => {
    await expectOk(await createJoinRequest(shopId, userId));

    const result = await createJoinRequest(shopId, userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("You have already requested to join this shop.");
    }
  });

  it("rejects when the shop does not exist", async () => {
    const result = await createJoinRequest("does-not-exist", userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Shop not found.");
    }
  });

  it("rejects when the user does not exist", async () => {
    const result = await createJoinRequest(shopId, "does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("User not found.");
    }
  });

  describe("approveJoinRequest", () => {
    it("approves a pending request and links a new customer record", async () => {
      const request = expectOk(await createJoinRequest(shopId, userId));

      const result = expectOk(
        await approveJoinRequest(shopId, request.membership.id, {
          createCustomerName: "Ali Khan",
          createCustomerPhone: "0300 1234567",
        }),
      );

      expect(result.membership.status).toBe("ACTIVE");
      expect(result.membership.customerId).toBe(result.customer.id);
      expect(result.customer.name).toBe("Ali Khan");
      expect(result.customer.phone).toBe("0300 1234567");
    });

    it("approves a pending request linked to an existing customer", async () => {
      const request = expectOk(await createJoinRequest(shopId, userId));
      const customerCount = await prisma.customer.count();
      const customer = await prisma.customer.create({
        data: {
          name: "Existing Customer",
          phone: "0311 1112223",
          shopId,
          customerId: `CST-${String(customerCount + 1).padStart(6, "0")}`,
        },
      });

      const result = expectOk(
        await approveJoinRequest(shopId, request.membership.id, {
          linkToCustomerId: customer.id,
        }),
      );

      expect(result.membership.status).toBe("ACTIVE");
      expect(result.membership.customerId).toBe(customer.id);
    });

    it("rejects approving a non-existent request", async () => {
      const result = await approveJoinRequest(shopId, "does-not-exist", {
        createCustomerName: "Ali Khan",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Join request not found or already decided.");
      }
    });
  });

  describe("rejectJoinRequest", () => {
    it("rejects a pending request", async () => {
      const request = expectOk(await createJoinRequest(shopId, userId));

      const result = expectOk(
        await rejectJoinRequest(shopId, request.membership.id),
      );

      expect(result.membership.status).toBe("REMOVED");
    });

    it("rejects rejecting a non-existent request", async () => {
      const result = await rejectJoinRequest(shopId, "does-not-exist");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Join request not found or already decided.");
      }
    });
  });
});

describe("listShopsWithMembership", () => {
  it("annotates shops with membership state", async () => {
    await expectOk(await createJoinRequest(shopId, userId));

    // Create another shop with no membership
    const otherShopCount = await prisma.shop.count();
    await prisma.shop.create({
      data: {
        name: "Other Shop",
        currency: "PKR",
        timezone: "Asia/Karachi",
        shopId: `SP-${String(otherShopCount + 1).padStart(6, "0")}`,
      },
    });

    const shops = await listShopsWithMembership(userId);

    const ownShop = shops.find((s) => s.id === shopId);
    const otherShop = shops.find((s) => s.id !== shopId);

    expect(ownShop?.membershipState).toBe("pending");
    // The other shop has no membership for this user
    expect(otherShop?.membershipState).toBe("none");
  });

  it("filters shops by name", async () => {
    const alphaCount = await prisma.shop.count();
    await prisma.shop.create({
      data: {
        name: "Alpha Foods",
        currency: "PKR",
        timezone: "Asia/Karachi",
        shopId: `SP-${String(alphaCount + 1).padStart(6, "0")}`,
      },
    });
    const betaCount = await prisma.shop.count();
    await prisma.shop.create({
      data: {
        name: "Beta Mart",
        currency: "PKR",
        timezone: "Asia/Karachi",
        shopId: `SP-${String(betaCount + 1).padStart(6, "0")}`,
      },
    });

    const shops = await listShopsWithMembership(userId, "alpha");
    expect(shops).toHaveLength(1);
    expect(shops[0]?.name).toBe("Alpha Foods");
  });
});
