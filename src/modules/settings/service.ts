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
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        summary: `Password changed for "${user.username}"`,
        before: null,
        after: { username: user.username, role: user.role },
      });
    });

    return ok({ signedOutEverywhere: true });
  } catch (error) {
    return handleError(error);
  }
}
