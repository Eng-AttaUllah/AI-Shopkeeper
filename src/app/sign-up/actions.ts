"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BCRYPT_COST, hash } from "@/lib/credentials";
import { signupRateLimiter } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/zod";
import { z } from "zod";

const shopkeeperSignupSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use at most 80 characters"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Use at least 2 characters")
    .max(50, "Username is too long.")
    .regex(/^[a-z0-9_-]+$/, "Use letters, numbers, underscores, or hyphens"),
  shopName: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use at most 80 characters"),
  password: z.string().min(8, "Use at least 8 characters").max(200, "Password is too long."),
});

export type ShopkeeperSignupState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | null;

export async function shopkeeperSignupAction(
  _previousState: ShopkeeperSignupState,
  formData: FormData,
): Promise<ShopkeeperSignupState> {
  const formUsername = String(formData.get("username") ?? "");

  const limit = signupRateLimiter.check(formUsername);
  if (!limit.allowed) {
    return {
      error: `Too many sign-up attempts. Try again in ${Math.ceil(
        limit.resetAfterMs / 1000,
      )} seconds.`,
    };
  }

  const parsed = shopkeeperSignupSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    shopName: formData.get("shopName"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { name, username, shopName, password } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return {
        error: "A shopkeeper with this username already exists.",
        fieldErrors: { username: "Already registered" },
      };
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: shopName,
          currency: "PKR",
          timezone: "Asia/Karachi",
        },
      });

      const user = await tx.user.create({
        data: {
          username,
          name,
          passwordHash: await hash(password, BCRYPT_COST),
          accountType: "SHOPKEEPER",
        },
      });

      await tx.shopMembership.create({
        data: {
          shopId: shop.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      return { shop, user };
    });

    // Sign the new shopkeeper in and send them to the dashboard. `signIn`
    // throws a redirect error on success, which Next.js handles.
    try {
      await signIn("credentials", {
        username: outcome.user.username,
        password: password,
        redirectTo: "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          error:
            "Shop created, but automatic sign-in failed. Please sign in from the login page.",
        };
      }

      throw error;
    }

    return null;
  } catch (error) {
    console.error("Shopkeeper signup error:", error);
    return {
      error: "Something went wrong while creating the shop. Please try again.",
    };
  }
}
