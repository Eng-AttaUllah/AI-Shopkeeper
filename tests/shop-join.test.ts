import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hash } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import { createJoinRequest } from "@/modules/customers/service";
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
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  const shop = await prisma.shop.create({
    data: { name: "Test Shop", currency: "PKR", timezone: "Asia/Karachi" },
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
});

describe("listShopsWithMembership", () => {
  it("annotates shops with membership state", async () => {
    await expectOk(await createJoinRequest(shopId, userId));

    // Create another shop with no membership
    await prisma.shop.create({
      data: { name: "Other Shop", currency: "PKR", timezone: "Asia/Karachi" },
    });

    const shops = await listShopsWithMembership(userId);

    const ownShop = shops.find((s) => s.id === shopId);
    const otherShop = shops.find((s) => s.id !== shopId);

    expect(ownShop?.membershipState).toBe("pending");
    // The other shop has no membership for this user
    expect(otherShop?.membershipState).toBe("none");
  });

  it("filters shops by name", async () => {
    await prisma.shop.create({
      data: { name: "Alpha Foods", currency: "PKR", timezone: "Asia/Karachi" },
    });
    await prisma.shop.create({
      data: { name: "Beta Mart", currency: "PKR", timezone: "Asia/Karachi" },
    });

    const shops = await listShopsWithMembership(userId, "alpha");
    expect(shops).toHaveLength(1);
    expect(shops[0]?.name).toBe("Alpha Foods");
  });
});
