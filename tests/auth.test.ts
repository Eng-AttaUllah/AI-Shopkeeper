import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  ensureOwner,
  loginSchema,
  ownerSchema,
  verifyCredentials,
} from "@/lib/credentials";
import { prisma } from "@/lib/db";

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("credentials", () => {
  it("creates one owner with a bcrypt hash, never the plain password", async () => {
    const result = await ensureOwner({
      username: "Owner",
      password: "shop-pass-123",
      name: "Shopkeeper",
    });

    expect(result.created).toBe(true);
    expect(result.user.username).toBe("owner");
    expect(result.user.role).toBe("OWNER");

    const stored = await prisma.user.findUnique({
      where: { username: "owner" },
    });

    expect(stored?.passwordHash).not.toBe("shop-pass-123");
    expect(stored?.passwordHash.startsWith("$2")).toBe(true);
  });

  it("is idempotent when the password is unchanged", async () => {
    const first = await ensureOwner({
      username: "owner",
      password: "shop-pass-123",
    });
    const before = await prisma.user.findUnique({
      where: { username: "owner" },
    });
    const second = await ensureOwner({
      username: "owner",
      password: "shop-pass-123",
    });
    const after = await prisma.user.findUnique({
      where: { username: "owner" },
    });

    expect(second.created).toBe(false);
    expect(second.passwordChanged).toBe(false);
    expect(second.user.tokenVersion).toBe(first.user.tokenVersion);
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it("updates the hash and invalidates sessions when the password changes", async () => {
    const first = await ensureOwner({
      username: "owner",
      password: "shop-pass-123",
    });
    const changed = await ensureOwner({
      username: "owner",
      password: "shop-pass-456",
    });

    expect(changed.created).toBe(false);
    expect(changed.passwordChanged).toBe(true);
    expect(changed.user.tokenVersion).toBe(first.user.tokenVersion + 1);

    expect(
      await verifyCredentials({
        username: "owner",
        password: "shop-pass-456",
      }),
    ).not.toBeNull();
    expect(
      await verifyCredentials({
        username: "owner",
        password: "shop-pass-123",
      }),
    ).toBeNull();
  });

  it("accepts the right password and rejects wrong, unknown, or malformed input", async () => {
    await ensureOwner({ username: "owner", password: "shop-pass-123" });

    const valid = await verifyCredentials({
      username: "  OWNER  ",
      password: "shop-pass-123",
    });

    expect(valid?.username).toBe("owner");
    expect(valid?.role).toBe("OWNER");
    expect(
      await verifyCredentials({
        username: "owner",
        password: "wrong-password",
      }),
    ).toBeNull();
    expect(
      await verifyCredentials({
        username: "nobody",
        password: "shop-pass-123",
      }),
    ).toBeNull();
    expect(await verifyCredentials(null)).toBeNull();
    expect(await verifyCredentials({ username: "owner" })).toBeNull();
    expect(
      await verifyCredentials({ username: "", password: "" }),
    ).toBeNull();
  });

  it("normalizes the username in the login schema", () => {
    const parsed = loginSchema.parse({
      username: "  OWNER  ",
      password: "secret",
    });

    expect(parsed.username).toBe("owner");
  });

  it("rejects an owner password shorter than eight characters", () => {
    expect(
      ownerSchema.safeParse({ username: "owner", password: "short" }).success,
    ).toBe(false);
  });
});
