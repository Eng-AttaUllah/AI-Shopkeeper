import { compare, hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";

/**
 * Username/password checks shared by Auth.js, the seed script, and tests.
 *
 * This file is deliberately free of Auth.js and Next.js imports so the
 * credential rules can be tested without starting a request context.
 */

const BCRYPT_COST = 12;

export { BCRYPT_COST, hash };

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your username.")
    .max(50, "Username is too long."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(200, "Password is too long."),
});

export const ownerSchema = z.object({
  username: loginSchema.shape.username,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "Password is too long."),
  name: z.string().trim().max(80, "Name is too long.").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Customer self-registration input. Phone is used as the username. */
export const customerRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(80, "Use at most 80 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number")
    .max(20, "Phone is too long")
    .regex(/^[0-9+\-() ]*$/, "Use digits, spaces, +, or -"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "Password is too long."),
  customerId: z.string().min(1, "Invalid customer").optional(),
});

export type CustomerRegistrationInput = z.infer<
  typeof customerRegistrationSchema
>;

/** The user fields Auth.js needs; never includes the password hash. */
export type AuthUser = {
  id: string;
  name: string | null;
  username: string;
  role: string;
  tokenVersion: number;
};

export type SafeUser = Pick<
  AuthUser,
  "id" | "username" | "role" | "tokenVersion"
>;

export type EnsureOwnerResult = {
  created: boolean;
  passwordChanged: boolean;
  user: SafeUser;
};

function toSafeUser(user: SafeUser): SafeUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Verify a username and password. Returns null for every failure so callers
 * cannot tell an unknown username from a wrong password.
 */
export async function verifyCredentials(
  input: unknown,
): Promise<AuthUser | null> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (!user) {
    return null;
  }

  const matches = await compare(parsed.data.password, user.passwordHash);

  if (!matches) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Create the single owner account, or update its password when the configured
 * password has changed. Re-running with the same password leaves the hash and
 * tokenVersion alone, so the seed stays idempotent.
 */
export async function ensureOwner(input: unknown): Promise<EnsureOwnerResult> {
  const parsed = ownerSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "The owner account details are invalid.",
    );
  }

  const { username, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      role: true,
      tokenVersion: true,
      passwordHash: true,
    },
  });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        username,
        name: name ?? "Shopkeeper",
        passwordHash: await hash(password, BCRYPT_COST),
        role: "OWNER",
      },
      select: { id: true, username: true, role: true, tokenVersion: true },
    });

    return { created: true, passwordChanged: false, user: toSafeUser(user) };
  }

  const matches = await compare(password, existing.passwordHash);

  if (matches) {
    return {
      created: false,
      passwordChanged: false,
      user: toSafeUser(existing),
    };
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash: await hash(password, BCRYPT_COST),
      tokenVersion: { increment: 1 },
    },
    select: { id: true, username: true, role: true, tokenVersion: true },
  });

  return { created: false, passwordChanged: true, user: toSafeUser(user) };
}
