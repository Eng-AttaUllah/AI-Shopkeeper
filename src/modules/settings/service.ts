import { compare, hash } from "bcryptjs";

import { writeAudit } from "@/lib/audit";
import { BCRYPT_COST } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { fail, ok, type Result } from "@/lib/result";
import { fieldErrors } from "@/lib/zod";

import { changePasswordSchema } from "./schema";
/** An error whose message is safe and useful to show the user. */
class ServiceError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function handleError(error: unknown): Result<never> {
  if (error instanceof ServiceError) {
    return fail(error.message, error.fieldErrors);
  }

  console.error("Settings service error:", error);
  return fail("Something went wrong while saving. Please try again.");
}

/**
 * Change the signed-in user's password.
 *
 * The current password must match, the new password is validated and hashed,
 * and `tokenVersion` is incremented so every existing session — including the
 * one that made the change — is signed out. The caller redirects to sign-in.
 * The whole write runs in one transaction with its audit row.
 */
export async function changeUserPassword(
  userId: string,
  input: unknown,
): Promise<Result<{ signedOutEverywhere: true }>> {
  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ServiceError("Account not found.");
    }

    const currentMatches = await compare(
      data.currentPassword,
      user.passwordHash,
    );

    if (!currentMatches) {
      throw new ServiceError("The current password is not correct.", {
        currentPassword: "Wrong password",
      });
    }

    if (data.currentPassword === data.newPassword) {
      throw new ServiceError("The new password must be different.", {
        newPassword: "Choose a different password",
      });
    }

    const passwordHash = await hash(data.newPassword, BCRYPT_COST);

    // Password change is scoped to the user's shop (their OWNER membership).
    const membership = await prisma.shopMembership.findFirst({
      where: { userId: user.id, role: "OWNER", status: "ACTIVE" },
      select: { shopId: true },
    });

    if (!membership) {
      throw new ServiceError("Account is not linked to a shop.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      await writeAudit(tx, {
        actor: user.username,
        shopId: membership.shopId,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        summary: `Password changed for "${user.username}"`,
        before: null,
        after: { username: user.username, accountType: user.accountType },
      });
    });

    return ok({ signedOutEverywhere: true });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Sign the user out of every device by incrementing `tokenVersion`. The
 * current session dies too, so the caller redirects to sign-in. One
 * transaction with its audit row, like a password change.
 */
export async function signOutEverywhere(
  userId: string,
): Promise<Result<{ signedOutEverywhere: true }>> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ServiceError("Account not found.");
    }

    // Sign out everywhere is scoped to the user's shop (their OWNER membership).
    const membership = await prisma.shopMembership.findFirst({
      where: { userId: user.id, role: "OWNER", status: "ACTIVE" },
      select: { shopId: true },
    });

    if (!membership) {
      throw new ServiceError("Account is not linked to a shop.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      await writeAudit(tx, {
        actor: user.username,
        shopId: membership.shopId,
        action: "SIGNED_OUT_EVERYWHERE",
        entityType: "User",
        entityId: user.id,
        summary: `Signed out every device for "${user.username}"`,
        before: null,
        after: { username: user.username, accountType: user.accountType },
      });
    });

    return ok({ signedOutEverywhere: true });
  } catch (error) {
    return handleError(error);
  }
}
