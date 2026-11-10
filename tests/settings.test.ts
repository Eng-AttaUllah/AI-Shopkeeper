import { compare, hash } from "bcryptjs";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BCRYPT_COST } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/result";
import {
  changeUserPassword,
  signOutEverywhere,
} from "@/modules/settings/service";

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got: ${result.error}`);
  }

  return result.data;
}

async function createUserWithPassword(password: string) {
  const shopCount = await prisma.shop.count();
  const shop = await prisma.shop.create({
    data: {
      shopId: `SP-${String(shopCount + 1).padStart(6, "0")}`,
      name: "Test Shop",
      currency: "PKR",
      timezone: "Asia/Karachi",
    },
  });
  return prisma.user.create({
    data: {
      username: "owner",
      name: "Shopkeeper",
      accountType: "SHOPKEEPER",
      passwordHash: await hash(password, BCRYPT_COST),
    },
  }).then(async (user) => {
    await prisma.shopMembership.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    return user;
  });
}

beforeEach(async () => {
  await prisma.shopMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("change password", () => {
  it("changes the password and signs out every session", async () => {
    const user = await createUserWithPassword("old-password");

    const result = await changeUserPassword(user.id, {
      currentPassword: "old-password",
      newPassword: "new-password-9",
      confirmPassword: "new-password-9",
    });

    expectOk(result);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });

    expect(updated?.tokenVersion).toBe(user.tokenVersion + 1);
    expect(await compare("new-password-9", updated!.passwordHash)).toBe(true);
    expect(await compare("old-password", updated!.passwordHash)).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "PASSWORD_CHANGED" },
    });

    expect(audit?.actor).toBe("owner");
    expect(audit?.entityId).toBe(user.id);
  });

  it("refuses a wrong current password", async () => {
    const user = await createUserWithPassword("old-password");

    const result = await changeUserPassword(user.id, {
      currentPassword: "not-the-password",
      newPassword: "new-password-9",
      confirmPassword: "new-password-9",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.currentPassword).toBeTruthy();
    }

    const unchanged = await prisma.user.findUnique({ where: { id: user.id } });

    expect(unchanged?.tokenVersion).toBe(user.tokenVersion);
    expect(await compare("old-password", unchanged!.passwordHash)).toBe(true);
  });

  it("refuses a new password that is the same as the current one", async () => {
    const user = await createUserWithPassword("old-password");

    const result = await changeUserPassword(user.id, {
      currentPassword: "old-password",
      newPassword: "old-password",
      confirmPassword: "old-password",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.newPassword).toBeTruthy();
    }
  });

  it("enforces the minimum length and matching confirmation", async () => {
    const user = await createUserWithPassword("old-password");

    const tooShort = await changeUserPassword(user.id, {
      currentPassword: "old-password",
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(tooShort.ok).toBe(false);

    const mismatch = await changeUserPassword(user.id, {
      currentPassword: "old-password",
      newPassword: "new-password-9",
      confirmPassword: "different-password",
    });

    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.fieldErrors?.confirmPassword).toBeTruthy();
    }

    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("refuses an unknown user", async () => {
    const result = await changeUserPassword("does-not-exist", {
      currentPassword: "whatever",
      newPassword: "new-password-9",
      confirmPassword: "new-password-9",
    });

    expect(result.ok).toBe(false);
  });
});

describe("sign out everywhere", () => {
  it("bumps tokenVersion and writes an audit row", async () => {
    const user = await createUserWithPassword("old-password");

    const result = await signOutEverywhere(user.id);

    expectOk(result);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });

    expect(updated?.tokenVersion).toBe(user.tokenVersion + 1);
    // The password itself is untouched.
    expect(await compare("old-password", updated!.passwordHash)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "SIGNED_OUT_EVERYWHERE" },
    });

    expect(audit?.actor).toBe("owner");
    expect(audit?.entityId).toBe(user.id);
  });

  it("refuses an unknown user", async () => {
    const result = await signOutEverywhere("does-not-exist");

    expect(result.ok).toBe(false);
  });
});
